let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d")
let imageSet = [];
let fusionDepth = [];
let maximumDepth = 0;

let imagesDiv = document.getElementById("images");
let stackingSettings = {
    sigmaA: 1.0,
    sigmaB: 4.0,
    stackDepth: 1,
    depthFactor: 60.0,
    depthSmooth: 8.0,
    depthStart: 0.5,
    invertDepth: false,
}

imagesDiv.addEventListener("mousedown", function (e) {
    let imageLoader = document.createElement("input");
    imageLoader.type = "file";
    imageLoader.accept = "image/*";
    imageLoader.multiple = true;
    imageLoader.addEventListener("change", handleImages, false);
    imageLoader.click();
    imageLoader.remove();
    imagesDiv.removeEventListener("mousedown", arguments.callee);
});

canvas.addEventListener("mousedown", function (e) {
    drawStacked();
});

function handleImages(e) {
    let files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        let img = new Image();
        img.onload = function () {
            let time = new Date().getTime();
            addImage({
                name: files[i].name,
                img: img,
                originalData: null,
                differenceOfGaussianStack: null,
                statusText: null});
            console.log("Loaded image " + i + " in " + (new Date().getTime() - time) + "ms");
        }
        img.src = URL.createObjectURL(files[i]);
    }
}

function clearImages() {
    imageSet = [];
    imagesDiv.innerHTML = "";
}

function addImage(image) {
    if (image.originalData !== null && image.differenceOfGaussianStack !== null) {
        return;
    }
    imageSet.push(image);
    let originalWidth = image.img.width;
    let originalHeight = image.img.height;
    let ratio = originalWidth / originalHeight;
    let img = document.createElement("img");
    let text = document.createElement("p");
    let container = document.createElement("div");
    container.classList.add("imgContainer");
    text.classList.add("statusText");
    text.innerHTML = "";
    container.appendChild(img);
    container.appendChild(text);
    image.statusText = text;
    img.src = image.img.src;
    let newWidth = originalWidth;
    let newHeight = newWidth / ratio;
    let imgStyleWidth = 400;
    let imgStyleHeight = imgStyleWidth / ratio;
    img.style.width = imgStyleWidth + "px";
    img.style.height = imgStyleHeight + "px";
    imagesDiv.appendChild(container);
    container.onclick = function () {
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.putImageData(differenceOfGaussian(image.originalData, stackingSettings.sigmaA, stackingSettings.sigmaB), 0, 0);
    }
    let tempCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    let tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    tempCtx.drawImage(image.img, 0, 0, originalWidth, originalHeight);
    image.originalData = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
    imageSet.sort((a, b) => a.name.localeCompare(b.name));
}

function differenceOfGaussian(imageData, s1, s2) {
    let originalWidth = imageData.width;
    let originalHeight = imageData.height;
    let imageCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    let tempCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    let tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    imageCanvas.width = originalWidth;
    imageCanvas.height = originalHeight;
    let imageCtx = imageCanvas.getContext("2d");
    imageCtx.putImageData(imageData, 0, 0);
    tempCtx.filter = "blur(" + s1 + "px)";
    tempCtx.drawImage(imageCanvas, 0, 0, originalWidth, originalHeight);
    let imageData1 = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
    tempCtx.filter = "blur(" + s2 + "px)";
    tempCtx.drawImage(imageCanvas, 0, 0, originalWidth, originalHeight);
    let imageData2 = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
    let result = ctx.createImageData(originalWidth, originalHeight);
    let data1 = imageData1.data;
    let data2 = imageData2.data;
    let resultData = result.data;
    for (let i = 0; i < originalHeight; i++) {
        for (let j = 0; j < originalWidth; j++) {
            for (let k = 0; k < 3; k++) {
                resultData[(i * originalWidth + j) * 4 + k] = Math.abs(data1[(i * originalWidth + j) * 4 + k] - data2[(i * originalWidth + j) * 4 + k]);
            }
            resultData[(i * originalWidth + j) * 4 + 3] = 255;
        }
    }
    return result;
}

function initializeDepths(w, h) {
    maximumDepth = 0;
    for (let i = 0; i < h; i++) {
        fusionDepth[i] = [];
        for (let j = 0; j < w; j++) {
            fusionDepth[i][j] = 0;
        }
    }
}

function addDepth(x, y, indicesAndScores) {
    let indices = indicesAndScores.indices;
    let scores = indicesAndScores.scores;
    let depth = 0;

    for (let k = 0; k < 3; k++) {
        depth += scores[k] * stackingSettings.invertDepth ? (imageSet.length - indices[k]) : indices[k];
    }
    if (depth > maximumDepth) {
        maximumDepth = depth;
    }
    fusionDepth[y][x] = depth;
}

function pickBestImage(x, y) {
    let maxWeight = [0, 0, 0];
    let maxWeightIndex = [0, 0, 0];
    let minWeight = [255, 255, 255];
    let minWeightIndex = [0, 0, 0];

    for (let i = 0; i < imageSet.length; i++) {
        let weight = [0, 0, 0];
        for (let j = 0; j < stackingSettings.stackDepth; j++) {
            let data = imageSet[i].differenceOfGaussianStack[j].data;
            let dataWidth = imageSet[i].differenceOfGaussianStack[j].width;
            for (let k = 0; k < 3; k++) {
                weight[k] += Math.abs(data[(y * dataWidth + x) * 4 + j]);
            }
        }
        for (let k = 0; k < 3; k++) {
            if (weight[k] > maxWeight[k]) {
                maxWeight[k] = weight[k];
                maxWeightIndex[k] = i;
            }
            if (weight[k] < minWeight[k]) {
                minWeight[k] = weight[k];
                minWeightIndex[k] = i;
            }
        }
    }

    let resultIndex = [0, 0, 0];
    let resultWeight = minWeight;

    for (let k = 0; k < 3; k++) {
        resultIndex[k] = maxWeightIndex[k]
        resultWeight[k] = maxWeight[k];
    }

    return {indices: resultIndex, scores: resultWeight};
}

function updateDifferenceOfGaussian(i, after) {
    if (imageSet[i].differenceOfGaussianStack === null) {
        imageSet[i].differenceOfGaussianStack = [];
        for (let j = 0; j < stackingSettings.stackDepth; j++) {
            let factor = 1 << j;
            imageSet[i].differenceOfGaussianStack.push(differenceOfGaussian(imageSet[i].originalData, stackingSettings.sigmaA * factor, stackingSettings.sigmaB * factor));
        }
    }
    drawStatus("Processed: " + (i + 1) + "/" + imageSet.length);
    if (i === imageSet.length - 1) {
        setTimeout(after, 0);
    } else {
        setTimeout(() => updateDifferenceOfGaussian(i + 1, after), 0);
    }
}

function drawDepthMap() {
    let depthMapCanvas = document.getElementById("depthMap");
    let depthMapCtx = depthMapCanvas.getContext("2d");
    depthMapCanvas.width = canvas.width;
    depthMapCanvas.height = canvas.height;
    let depthMapData = depthMapCtx.createImageData(canvas.width, canvas.height);
    let depthMap = depthMapData.data;
    for (let i = 0; i < depthMapCanvas.height; i++) {
        for (let j = 0; j < depthMapCanvas.width; j++) {
            let depth = fusionDepth[i][j] / maximumDepth;
            for (let k = 0; k < 3; k++) {
                depthMap[(i * canvas.width + j) * 4 + k] = (depth * 255) | 0;
            }
            depthMap[(i * canvas.width + j) * 4 + 3] = 255;
        }
    }
    depthMapCtx.putImageData(depthMapData, 0, 0);
    setTimeout(() => {
        drawEye(1.0, document.getElementById("leftImage"));
        setTimeout(() => {
            drawEye(-1.0, document.getElementById("rightImage"));
            setTimeout(() => {
                drawAnaglyph();
            }, 0);
        }, 0);
    }, 0);
    
}

function drawEye(sign, canvasObject) {
    let depthMapCanvas = document.getElementById("depthMap");
    let smoothenedDepthMapCanvas = new OffscreenCanvas(depthMapCanvas.width, depthMapCanvas.height);
    let smoothenedDepthMapCtx = smoothenedDepthMapCanvas.getContext("2d");
    smoothenedDepthMapCanvas.width = depthMapCanvas.width;
    smoothenedDepthMapCanvas.height = depthMapCanvas.height;
    smoothenedDepthMapCtx.filter = "blur(" + (stackingSettings.depthSmooth) + "px)";
    smoothenedDepthMapCtx.drawImage(depthMapCanvas, 0, 0, depthMapCanvas.width, depthMapCanvas.height);
    let smoothenedDepthMapData = smoothenedDepthMapCtx.getImageData(0, 0, canvas.width, canvas.height);
    let depthData = smoothenedDepthMapData.data;
    let context = canvasObject.getContext("2d");
    canvasObject.width = canvas.width;
    canvasObject.height = canvas.height;
    let imageData = context.createImageData(canvas.width, canvas.height);
    let data = imageData.data;
    let originalFusionData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < canvasObject.height; i++) {
        for (let j = 0; j < canvasObject.width; j++) {
            let depth = (depthData[(i * canvas.width + j) * 4] / 255) * stackingSettings.depthFactor - stackingSettings.depthFactor * stackingSettings.depthStart;
            let x = (j + sign * depth) | 0;
            let y = i;
            if (x >= 0 && x < canvasObject.width && y >= 0 && y < canvasObject.height) {
                for (let k = 0; k < 3; k++) {
                    data[(i * canvas.width + j) * 4 + k] = originalFusionData.data[(y * canvas.width + x) * 4 + k];
                }
                data[(i * canvas.width + j) * 4 + 3] = 255;
            }
        }
    }
    context.putImageData(imageData, 0, 0);
}

function drawAnaglyph() {
    // Note: left and right are swapped because anaglyphs are swapped with respect to cross-eye
    let leftCanvas = document.getElementById("rightImage");
    let rightCanvas = document.getElementById("leftImage");
    let anaglyphCanvas = document.getElementById("anaglyph");
    let anaglyphCtx = anaglyphCanvas.getContext("2d");
    anaglyphCanvas.width = leftCanvas.width;
    anaglyphCanvas.height = leftCanvas.height;
    let anaglyphData = anaglyphCtx.createImageData(leftCanvas.width, leftCanvas.height);
    let anaglyph = anaglyphData.data;
    let leftData = leftCanvas.getContext("2d").getImageData(0, 0, leftCanvas.width, leftCanvas.height).data;
    let rightData = rightCanvas.getContext("2d").getImageData(0, 0, rightCanvas.width, rightCanvas.height).data;

    for (let i = 0; i < anaglyphCanvas.height; i++) {
        for (let j = 0; j < anaglyphCanvas.width; j++) {
            let redChannel = (0.7 * leftData[(i * leftCanvas.width + j) * 4 + 0]) + (0.3 * leftData[(i * rightCanvas.width + j) * 4 + 2]);
            let gamma = 1.5;
            let gammaCorrectedRedChannel = (Math.pow(redChannel / 255, 1/gamma) * 255) | 0;
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 0] = gammaCorrectedRedChannel;
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 1] = rightData[(i * rightCanvas.width + j) * 4 + 1];
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 2] = rightData[(i * rightCanvas.width + j) * 4 + 2];
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 3] = 255;
        }
    }
    anaglyphCtx.putImageData(anaglyphData, 0, 0);
}

function drawStacked() {
    if (imageSet.length === 0)
        return;
    canvas.width = imageSet[0].img.width;
    canvas.height = imageSet[0].img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    initializeDepths(canvas.width, canvas.height);
    setTimeout(() => updateDifferenceOfGaussian(0, () => {
        let imageData = ctx.createImageData(canvas.width, canvas.height);
        setTimeout(() => drawStackedChunk(imageData, 0, Math.max(1, (canvas.width / 100) | 0)), 0);
    }), 0);
}

function drawStackedChunk(imageData, x1, x2) {
    let data = imageData.data;
    for (let x = x1; x < x2; x++) {
        for (let y = 0; y < canvas.height; y++) {
            let bestImage = pickBestImage(x, y);
            for (let k = 0; k < 3; k++)
                data[(y * canvas.width + x) * 4 + k] = imageSet[bestImage.indices[k]].originalData.data[(y * canvas.width + x) * 4 + k];
            data[(y * canvas.width + x) * 4 + 3] = 255;
            addDepth(x, y, bestImage);
        }
    }
    // Draw percentage progress
    drawStatus("Stacking: " + (100 * x1 / canvas.width).toFixed(0) + "%");
    if (x2 === canvas.width) {
        ctx.putImageData(imageData, 0, 0);
        setTimeout(() => drawDepthMap(), 0);
    } else {
        setTimeout(() => drawStackedChunk(imageData, x2, Math.min(x2 + (x2 - x1), canvas.width)), 0);
    }
}

function drawStatus(text) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "120px Arial";
    let metrics = ctx.measureText(text);
    let textWidth = metrics.width;
    ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 2);
}

function LoG(x, y, s) {
    return -1 / (Math.PI * Math.pow(s, 4)) * (1 - (x * x + y * y) / (2 * s * s)) * Math.exp(-(x * x + y * y) / (2 * s * s));
}