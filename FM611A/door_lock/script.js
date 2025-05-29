// 儲存 cookie(cookie的名字、cookie的值、儲存的天數)
function setCookie(cname, cvalue, exdays) {
  let d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000)); // 因為是毫秒, 所以要乘以1000
  let expires = "expires=" + d.toGMTString();
  document.cookie = cname + "=" + cvalue + "; " + expires;
}

// 取得 cookie
function getCookie(cname) {
  let name = cname + "=";
  let ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  }
  return "";
}

// 取得個別元素
const video1 = document.getElementById('inputVideo')
const idn = document.getElementById('identify')
const board_url = document.referrer;

// 取得人名
let labelStr = getCookie("labelStr");
if (labelStr == "") labelStr = "Teddy,Chuan";
labelStr = prompt("請輸入名稱並以逗號隔開人名:", labelStr);
let labels = labelStr.toString().split(",")

// 讓輸入框圓角一點
$('input:text').addClass("ui-widget ui-widget-content ui-corner-all ui-textfield");

Promise.all([
  mask.style.display = "block",
  loadImg.style.display = "block",
  faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
  console.log("模型載入成功"),
]).then(startVideo)

async function startVideo() {
  await navigator.mediaDevices.getUserMedia({ video: {} })
    .then(function (stream) {
      video1.srcObject = stream;
    })
  await video1.play();
  initRecognizeFaces()
}

let labeledDescriptors;
let faceMatcher;
let canvas;
let detections;
let resizedDetections;
let results;
let displaySize;

function changeCanvasSize() {
  canvas.style.width = video1.offsetWidth.toString() + "px"
  canvas.style.height = video1.offsetHeight.toString() + "px"
  canvas.style.left = getPosition(video1)["x"] + "px";
  canvas.style.top = getPosition(video1)["y"] + "px";
  displaySize = { width: video1.offsetWidth, height: video1.offsetHeight }
  faceapi.matchDimensions(canvas, displaySize)
}

async function initRecognizeFaces() {
  labeledDescriptors = await loadLabel()
  faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.7)
  canvas = faceapi.createCanvasFromMedia(video1)
  document.body.append(canvas)
  mask.style.display = "none"
  loadImg.style.display = "none"
  changeCanvasSize()
  window.addEventListener("resize", changeCanvasSize);
  console.log("初始化成功")
}

async function recognizeFaces() {
  detections = await faceapi.detectAllFaces(video1).withFaceLandmarks().withFaceDescriptors()
  resizedDetections = faceapi.resizeResults(detections, displaySize)
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  results = resizedDetections.map((d) => {
    return faceMatcher.findBestMatch(d.descriptor)
  })

  // 建立辨識成功者的名單
  let matchedLabels = new Set();

  results.forEach((result, i) => {
    const label = result.label;
    const distance = result.distance;

    console.log(`辨識結果: ${label}, 相似度: ${distance}`);
    if (label !== "unknown" && distance < 0.6) {
      matchedLabels.add(label);
    }

    const box = resizedDetections[i].detection.box
    const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() })
    drawBox.draw(canvas)
  })

  // 指定需要同時通過的人名
  const requiredPeople = new Set(["Teddy", "Chuan"]);

  let allMatched = true;
  requiredPeople.forEach(person => {
    if (!matchedLabels.has(person)) {
      allMatched = false;
    }
  });

  if (allMatched) {
    console.log("所有指定人員皆通過辨識，開啟門鎖！");
    $.get(board_url + 'open');
  } else {
    console.log("尚未全部通過辨識，門鎖未開啟。");
  }

  setTimeout(() => {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }, 1000)
}

$('#identify').click((e) => {
  console.log("辨識中...");
  recognizeFaces();
});

function loadLabel() {
  let labels_len = labels.length;
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = []
      for (let i = 1; i <= 3; i++) {
        let img;
        try {
          img = await faceapi.fetchImage(`images/${label}/${i}.jpg`)
        } catch {
          try {
            img = await faceapi.fetchImage(`images/${label}/${i}.png`)
          } catch {
            alert("名稱有誤或圖片錯誤, 請重新確認!!");
            window.location.reload()
          }
        }
        const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
        if (detections) {
          descriptions.push(detections.descriptor)
        } else {
          alert(`無法提取 ${label} 的第 ${i} 張人臉特徵, 請更換照片再試試看！`)
        }
      }
      labels_len--
      if (labels_len == 0) {
        setCookie("labelStr", labelStr, 30);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions)
    })
  )
}

function getPosition(element) {
  let x = 0;
  let y = 0;
  while (element) {
    x += element.offsetLeft - element.scrollLeft + element.clientLeft;
    y += element.offsetTop - element.scrollLeft + element.clientTop;
    element = element.offsetParent;
  }
  return { x: x, y: y };
}
