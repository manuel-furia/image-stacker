let mainCanvas = document.getElementById("canvas");
let mainCanvasCtx = mainCanvas.getContext("2d")

let imagesDiv = document.getElementById("images");

let stackingData = {
    imageSet: [],
    fusionDepth: [],
    maximumDepth: 0
}

let anaglyphSettings = {
    leftMatrix: [
        [0.7, 0.3, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0]
    ],
    rightMatrix: [
        [0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0]
    ],
    leftGamma: 1.3,
    rightGamma: 1.0,
    depthFactor: 20.0,
    depthSmooth: 2.0,
    depthStart: -1.0,
}

let stackingSettings = {
    sigmaA: 1.0,
    sigmaB: 4.0,
    stackDepth: 1,
    topBias: 0.0,
    bottomBias: 0.0,
    invertImages: false,
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

mainCanvas.addEventListener("mousedown", function (e) {
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
                imgContainer: null,
                originalData: null,
                differenceOfGaussianStack: null,
                statusText: null});
            console.log("Loaded image " + i + " in " + (new Date().getTime() - time) + "ms");
        }
        img.src = URL.createObjectURL(files[i]);
    }
}

function clearImages() {
    stackingData.imageSet = [];
    imagesDiv.innerHTML = "";
}

function removeImage(image) {
    let index = stackingData.imageSet.indexOf(image);
    if (index !== -1) {
        stackingData.imageSet.splice(index, 1);
        updateImagesDiv();
    }
}

function addImage(image) {
    if (image.originalData !== null && image.differenceOfGaussianStack !== null) {
        return;
    }
    stackingData.imageSet.push(image);
    let originalWidth = image.img.width;
    let originalHeight = image.img.height;
    let ratio = originalWidth / originalHeight;
    let img = document.createElement("img");
    let text = document.createElement("p");
    let removeButton = document.createElement("div");
    let container = document.createElement("div");
    container.classList.add("imgContainer");
    text.classList.add("statusText");
    text.innerHTML = "";
    removeButton.classList.add("removeButton");
    removeButton.innerHTML = "X";
    removeButton.onclick = function () {
        removeImage(image);
    }
    container.appendChild(removeButton);
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
    image.imgContainer = container;
    container.onclick = function (e) {
        if (e.target === removeButton) {
            return;
        }
        mainCanvas.width = newWidth;
        mainCanvas.height = newHeight;
        mainCanvasCtx.putImageData(differenceOfGaussian(image.originalData, stackingSettings.sigmaA, stackingSettings.sigmaB), 0, 0);
    }
    let tempCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    let tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    tempCtx.drawImage(image.img, 0, 0, originalWidth, originalHeight);
    image.originalData = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
    updateImagesDiv();
}
function updateImagesDiv() {
    if (stackingSettings.invertImages) {
        stackingData.imageSet.sort((a, b) => b.name.localeCompare(a.name));
    } else {
        stackingData.imageSet.sort((a, b) => a.name.localeCompare(b.name));
    }
    imagesDiv.innerHTML = "";
    for (let i = 0; i < stackingData.imageSet.length; i++) {
        stackingData.imageSet[i].statusText.innerHTML = i + 1;
        imagesDiv.appendChild(stackingData.imageSet[i].imgContainer);
    }
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
    let result = mainCanvasCtx.createImageData(originalWidth, originalHeight);
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
    stackingData.maximumDepth = 0;
    for (let i = 0; i < h; i++) {
        stackingData.fusionDepth[i] = [];
        for (let j = 0; j < w; j++) {
            stackingData.fusionDepth[i][j] = 0;
        }
    }
}

function addDepth(x, y, indicesAndScores) {
    let indices = indicesAndScores.indices;
    let depth = 0;

    for (let k = 0; k < 3; k++) {
        depth += indices[k] / 3;
    }
    if (depth > stackingData.maximumDepth) {
        stackingData.maximumDepth = depth;
    }
    stackingData.fusionDepth[y][x] = depth;
}

function pickBestImage(x, y) {
    let maxWeight = [0, 0, 0];
    let maxWeightIndex = [0, 0, 0];
    let imageSet = stackingData.imageSet;

    for (let i = 0; i < imageSet.length; i++) {
        let weight = [0, 0, 0];
        let bottomBias = (i === 0) ? (stackingSettings.bottomBias * 255) : 0;
        let topBias = (i === imageSet.length - 1) ? (stackingSettings.topBias * 255) : 0;
        for (let j = 0; j < stackingSettings.stackDepth; j++) {
            let data = imageSet[i].differenceOfGaussianStack[j].data;
            let dataWidth = imageSet[i].differenceOfGaussianStack[j].width;
            for (let k = 0; k < 3; k++) {
                weight[k] += Math.abs(data[(y * dataWidth + x) * 4 + j]) + bottomBias + topBias;
            }
        }
        for (let k = 0; k < 3; k++) {
            if (weight[k] > maxWeight[k]) {
                maxWeight[k] = weight[k];
                maxWeightIndex[k] = i;
            }
        }
    }

    return {indices: maxWeightIndex, scores: maxWeight};
}

function updateDifferenceOfGaussian(i, after) {
    let imageSet = stackingData.imageSet;
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
    let originalDepthMapCanvas = new OffscreenCanvas(mainCanvas.width, mainCanvas.height);
    let originalDepthMapCtx = originalDepthMapCanvas.getContext("2d");
    depthMapCanvas.width = mainCanvas.width;
    depthMapCanvas.height = mainCanvas.height;
    let depthMapData = originalDepthMapCtx.createImageData(mainCanvas.width, mainCanvas.height);
    let depthMap = depthMapData.data;
    for (let i = 0; i < depthMapCanvas.height; i++) {
        for (let j = 0; j < depthMapCanvas.width; j++) {
            let depth = stackingData.fusionDepth[i][j] / stackingData.maximumDepth;
            for (let k = 0; k < 3; k++) {
                depthMap[(i * mainCanvas.width + j) * 4 + k] = (depth * 255) | 0;
            }
            depthMap[(i * mainCanvas.width + j) * 4 + 3] = 255;
        }
    }
    originalDepthMapCtx.putImageData(depthMapData, 0, 0);
    depthMapCtx.filter = "blur(" + (anaglyphSettings.depthSmooth) + "px)";
    depthMapCtx.drawImage(originalDepthMapCanvas, 0, 0, depthMapCanvas.width, depthMapCanvas.height);
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
    let depthMapCtx = depthMapCanvas.getContext("2d");
    let depthMapData = depthMapCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    let depthData = depthMapData.data;
    let context = canvasObject.getContext("2d");
    canvasObject.width = mainCanvas.width;
    canvasObject.height = mainCanvas.height;
    let imageData = context.createImageData(mainCanvas.width, mainCanvas.height);
    let data = imageData.data;
    let originalFusionData = mainCanvasCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    for (let i = 0; i < canvasObject.height; i++) {
        for (let j = 0; j < canvasObject.width; j++) {
            let depth = (depthData[(i * mainCanvas.width + j) * 4] / 255) * anaglyphSettings.depthFactor + anaglyphSettings.depthFactor * anaglyphSettings.depthStart;
            let x = (j + sign * depth) | 0;
            let y = i;
            if (x >= 0 && x < canvasObject.width && y >= 0 && y < canvasObject.height) {
                for (let k = 0; k < 3; k++) {
                    data[(i * mainCanvas.width + j) * 4 + k] = originalFusionData.data[(y * mainCanvas.width + x) * 4 + k];
                }
                data[(i * mainCanvas.width + j) * 4 + 3] = 255;
            }
        }
    }
    context.putImageData(imageData, 0, 0);
}

function gammaCorrection(intensity, gamma) {
    return Math.pow(intensity / 255, 1 / gamma) * 255;
}

function vectorMultiply(matrix, vector) {
    let result = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        result[i] = 0;
        for (let j = 0; j < 3; j++) {
            result[i] += matrix[i][j] * vector[j];
        }
    }
    return result;
}

function drawAnaglyph() {
    let leftCanvas = document.getElementById("leftImage");
    let rightCanvas = document.getElementById("rightImage");
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
            let leftColor = [0, 0, 0];
            let rightColor = [0, 0, 0];
            for (let k = 0; k < 3; k++) {
                // NOTE: In anaglyphs, the left and right images are swapped compare to cross-eye
                leftColor[k] = rightData[(i * leftCanvas.width + j) * 4 + k];
                rightColor[k] = leftData[(i * rightCanvas.width + j) * 4 + k];
            }
            let leftMatrix = anaglyphSettings.leftMatrix;
            let rightMatrix = anaglyphSettings.rightMatrix;
            const leftContribution = vectorMultiply(leftMatrix, leftColor);
            const rightContribution = vectorMultiply(rightMatrix, rightColor);
            let redChannel =  gammaCorrection(leftContribution[0], anaglyphSettings.leftGamma) + gammaCorrection(rightContribution[0], anaglyphSettings.rightGamma);
            let greenChannel = gammaCorrection(leftContribution[1], anaglyphSettings.leftGamma) + gammaCorrection(rightContribution[1], anaglyphSettings.rightGamma);
            let blueChannel = gammaCorrection(leftContribution[2], anaglyphSettings.leftGamma) + gammaCorrection(rightContribution[2], anaglyphSettings.rightGamma);
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 0] = redChannel;
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 1] = greenChannel;
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 2] = blueChannel;
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 3] = 255;
        }
    }
    anaglyphCtx.putImageData(anaglyphData, 0, 0);
}

function drawStacked() {
    let imageSet = stackingData.imageSet;
    if (imageSet.length === 0)
        return;
    mainCanvas.width = imageSet[0].img.width;
    mainCanvas.height = imageSet[0].img.height;
    mainCanvasCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    initializeDepths(mainCanvas.width, mainCanvas.height);
    setTimeout(() => updateDifferenceOfGaussian(0, () => {
        let imageData = mainCanvasCtx.createImageData(mainCanvas.width, mainCanvas.height);
        setTimeout(() => drawStackedChunk(imageData, 0, Math.max(1, (mainCanvas.width / 100) | 0)), 0);
    }), 0);
}

function drawStackedChunk(imageData, x1, x2) {
    let imageSet = stackingData.imageSet;
    let data = imageData.data;
    for (let x = x1; x < x2; x++) {
        for (let y = 0; y < mainCanvas.height; y++) {
            let bestImage = pickBestImage(x, y);
            for (let k = 0; k < 3; k++)
                data[(y * mainCanvas.width + x) * 4 + k] = imageSet[bestImage.indices[k]].originalData.data[(y * mainCanvas.width + x) * 4 + k];
            data[(y * mainCanvas.width + x) * 4 + 3] = 255;
            addDepth(x, y, bestImage);
        }
    }
    // Draw percentage progress
    drawStatus("Stacking: " + (100 * x1 / mainCanvas.width).toFixed(0) + "%");
    if (x2 === mainCanvas.width) {
        mainCanvasCtx.putImageData(imageData, 0, 0);
        setTimeout(() => drawDepthMap(), 0);
    } else {
        setTimeout(() => drawStackedChunk(imageData, x2, Math.min(x2 + (x2 - x1), mainCanvas.width)), 0);
    }
}

function drawStatus(text) {
    mainCanvasCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCanvasCtx.fillStyle = "#ffffff";
    mainCanvasCtx.font = "120px Arial";
    let metrics = mainCanvasCtx.measureText(text);
    let textWidth = metrics.width;
    mainCanvasCtx.fillText(text, (mainCanvas.width - textWidth) / 2, mainCanvas.height / 2);
}

function LoG(x, y, s) {
    return -1 / (Math.PI * Math.pow(s, 4)) * (1 - (x * x + y * y) / (2 * s * s)) * Math.exp(-(x * x + y * y) / (2 * s * s));
}