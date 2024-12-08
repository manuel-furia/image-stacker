/*
 This file is part of Image Stacker.
 Copyright (C) 2024 Manuel Furia

 Image Stacker is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const STD_WIDTH = 1920;
let mainCanvas = document.getElementById("canvas");
let mainCanvasCtx = mainCanvas.getContext("2d");

let animationCanvas = document.getElementById("animationCanvas");
let animationCtx = animationCanvas.getContext("2d");

let imagesDiv = document.getElementById("images");

let stackingData = {
    imageSet: [],
    fusionDepth: [],
    maximumDepth: 0
}

let statusData = {
    stackComputed: false,
    depthComputed: false,
    eyesComputed: false,
    anaglyphComputed: false,
    resetAll,
    refreshDepth,
    refreshEyes,
    refreshAnaglyph,
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
    leftGamma: 1.4,
    rightGamma: 0.9,
    depthScale: 45.0,
    depthSmooth: 2.0,
    depthOffset: -1,
    depthGamma: 1.0,
}

let stackingSettings = {
    sigmaA: 1.0,
    sigmaB: 4.0,
    topBias: 0.0,
    bottomBias: 0.0,
    invertImages: false,
}

let animationSettings = {
    speed: 1.0,
    strength: 25.0,
}

let animationCaptureStatus = {
    computing: false,
    currentFrame: 0,
    targetFrames: 0,
    frames: [],
    result: null,
    animateId: null,
}

let settingsUI = SettingHandler(
    stackingSettings,
    anaglyphSettings,
    animationSettings,
    resetAll,
    refreshDepth,
    refreshEyes,
    refreshAnaglyph,
);

settingsUI.updateUIValues();
settingsUI.registerUIEvents();

clearImages();

document.getElementById("newStack").addEventListener("mousedown", function (e) {
    if (!document.getElementById("newStack").classList.contains("disabledButton")) {
        clearImages();
    }
});

function clearImages() {
    resetAll();
    stackingData.imageSet.length = 0;
    stackingData.fusionDepth.length = 0;
    stackingData.maximumDepth = 0;
    updateImagesDiv();
    imagesDiv.innerText = "Click here to load images to stack";
    imagesDiv.addEventListener("mousedown", importImagesListener);
    document.getElementById("stackingSettings").style.display = "";
    document.getElementById("compute").style.display = "";
    document.getElementById("orModeDiv").style.display = "";
    document.getElementById("images").style.display = "";
    document.getElementById("premadeMode").style.display = "";
    document.getElementById("downloadStacked").style.display = "";
    document.getElementById("depthMapSettings").style.display = "";
    document.getElementById("downloadDepth").style.display = "";
    document.getElementById("loadStack").classList.add("invisible");
    document.getElementById("loadDepthMap").classList.add("invisible");
}

document.getElementById("loadSettings").addEventListener("mousedown", function (e) {
    let settingsLoader = document.createElement("input");
    settingsLoader.type = "file";
    settingsLoader.accept = ".stackersettings";
    settingsLoader.addEventListener("change", loadSettings, false);
    settingsLoader.click();
    settingsLoader.remove();
});

document.getElementById("loadStack").addEventListener("mousedown", function (e) {
    let imageLoader = document.createElement("input");
    imageLoader.type = "file";
    imageLoader.accept = "image/*";
    imageLoader.multiple = false;
    imageLoader.addEventListener("change", handleLoadCustomStack, false);
    imageLoader.click();
    imageLoader.remove();
});

document.getElementById("loadDepthMap").addEventListener("mousedown", function (e) {
    let depthMapLoader = document.createElement("input");
    depthMapLoader.type = "file";
    depthMapLoader.accept = "image/*";
    depthMapLoader.multiple = false;
    depthMapLoader.addEventListener("change", handleLoadCustomDepth, false);
    depthMapLoader.click();
    depthMapLoader.remove();
});

function handleLoadCustomStack(e) {
    let files = e.target.files;
    if (files.length === 0) {
        return;
    }
    loadIntoCanvas(files[0], mainCanvas).then(() => {
        document.getElementById("loadDepthMap").classList.remove("disabledButton");
        if (depthMap.width !== 0) {
            refreshEyes();
        }
    });
}

function handleLoadCustomDepth(e) {
    if (document.getElementById("loadDepthMap").classList.contains("disabledButton")) {
        return;
    }
    let files = e.target.files;
    if (files.length === 0) {
        return;
    }
    loadIntoCanvas(files[0], document.getElementById("depthMap")).then(() => {
        renormalizeDepthMap(document.getElementById("depthMap").getContext("2d"));
    }).then(() => {
        if (mainCanvas.width !== 0) {
            refreshEyes();
        }
    });
}

function loadIntoCanvas(file, canvas) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height);	
            resolve(img);
        }
        img.src = URL.createObjectURL(file);
    });
}

function loadSettings(e) {
    let files = e.target.files;
    if (files.length === 0) {
        return;
    }
    let file = files[0];
    let reader = new FileReader();
    reader.onload = function (e) {
        let settings = JSON.parse(e.target.result);
        copyIntoObject(stackingSettings, settings.stackingSettings);
        copyIntoObject(anaglyphSettings, settings.anaglyphSettings);
        settingsUI.updateUIValues();
    }
    reader.readAsText(file);
}

function copyIntoObject(destination, source) {
    for (let key in source) {
        if (source.hasOwnProperty(key)) {
            destination[key] = source[key];
        }
    }
}

document.getElementById("saveSettings").addEventListener("mousedown", function (e) {
    let settings = {
        stackingSettings: stackingSettings,
        anaglyphSettings: anaglyphSettings
    };
    let settingsString = JSON.stringify(settings);
    let blob = new Blob([settingsString], {type: "text/plain;charset=utf-8"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "saved.stackersettings";
    a.click();
    a.remove();
});

document.getElementById("premadeMode").addEventListener("mousedown", function (e) {
    document.getElementById("stackingSettings").style.display = "none";
    document.getElementById("compute").style.display = "none";
    document.getElementById("orModeDiv").style.display = "none";
    document.getElementById("images").style.display = "none";
    document.getElementById("premadeMode").style.display = "none";
    document.getElementById("downloadStacked").style.display = "none";
    document.getElementById("depthMapSettings").style.display = "none";
    document.getElementById("downloadDepth").style.display = "none";
    document.getElementById("loadStack").classList.remove("invisible");
    document.getElementById("loadDepthMap").classList.remove("invisible");
    document.getElementById("loadDepthMap").classList.add("disabledButton");
});


function resetAll() {
    stackingData.imageSet.forEach((image) => {
        image.differenceOfGaussian = null;
    });
    updateImagesDiv();
    mainCanvasCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCanvas.width = 0;
    mainCanvas.height = 0;
    if (!statusData.stackComputed) {
        return;
    }
    resetAnimation();
    stackingData.fusionDepth = [];
    stackingData.maximumDepth = 0;
    document.getElementById("depthMap").width = 0;
    document.getElementById("depthMap").height = 0;
    document.getElementById("leftImage").width = 0;
    document.getElementById("leftImage").height = 0;
    document.getElementById("rightImage").width = 0;
    document.getElementById("rightImage").height = 0;
    document.getElementById("anaglyph").width = 0;
    document.getElementById("anaglyph").height = 0;
    statusData.stackComputed = false;
    document.getElementById("downloadStacked").classList.add("disabledButton");
    document.getElementById("downloadDepth").classList.add("disabledButton");
    document.getElementById("downloadStereoLeft").classList.add("disabledButton");
    document.getElementById("downloadStereo").classList.add("disabledButton");
    document.getElementById("downloadStereoRight").classList.add("disabledButton");
    document.getElementById("downloadAnaglyph").classList.add("disabledButton");
    enableCompute();
}

function resetAnimation() {
    animationCaptureStatus.result = null;
    animationCaptureStatus.frames = [];
    animationCaptureStatus.computing = false;
    animationCaptureStatus.currentFrame = 0;
    animationCaptureStatus.targetFrames = 0;
    if (animationCaptureStatus.animateId !== null) {
        clearInterval(animationCaptureStatus.animateId);
        animationCaptureStatus.animateId = null;
    }
    document.getElementById("animationCanvas").width = 0;
    document.getElementById("animationCanvas").height = 0;
    document.getElementById("downloadAnimation").classList.add("disabledButton");
    document.getElementById("computeAnimation").innerText = "Compute Animation";
    enableCompute("computeAnimation");
}

function refreshAnaglyph() {
    document.getElementById("anaglyph").width = 0;
    document.getElementById("anaglyph").height = 0;
    statusData.anaglyphComputed = false;
    document.getElementById("downloadAnaglyph").classList.add("disabledButton");
    return drawAnaglyphsAsync().then(() => {
        enableCompute("computeAnimation");
    });
}

function refreshDepth() {
    document.getElementById("depthMap").width = 0;
    document.getElementById("depthMap").height = 0;
    statusData.depthComputed = false;
    document.getElementById("downloadDepth").classList.add("disabledButton");
    document.getElementById("downloadStereoLeft").classList.add("disabledButton");
    document.getElementById("downloadStereo").classList.add("disabledButton");
    document.getElementById("downloadStereoRight").classList.add("disabledButton");
    document.getElementById("downloadAnaglyph").classList.add("disabledButton");
    return drawDepthMapAsync().then(() => {
        refreshEyes();
    });
}

function refreshEyes() {
    document.getElementById("leftImage").width = 0;
    document.getElementById("leftImage").height = 0;
    document.getElementById("rightImage").width = 0;
    document.getElementById("rightImage").height = 0;
    statusData.eyesComputed = false;
    document.getElementById("downloadStereoLeft").classList.add("disabledButton");
    document.getElementById("downloadStereo").classList.add("disabledButton");
    document.getElementById("downloadStereoRight").classList.add("disabledButton");
    document.getElementById("downloadAnaglyph").classList.add("disabledButton");
    return drawEyesAsync().then(() => {
        refreshAnaglyph();
    });
}

function toStdSize(size, imageWidth) {
    return size * imageWidth / STD_WIDTH;
}

function importImagesListener() {
    document.getElementById("premadeMode").style.display = "none";
    document.getElementById("orModeDiv").style.display = "none";
    let imageLoader = document.createElement("input");
    imageLoader.type = "file";
    imageLoader.accept = "image/*";
    imageLoader.multiple = true;
    imageLoader.addEventListener("change", handleImages, false);
    imageLoader.click();
    imageLoader.remove();
    imagesDiv.removeEventListener("mousedown", arguments.callee);
}

function disableCompute(buttonId="compute") {
    document.getElementById(buttonId).classList.add("disabledButton");
    document.getElementById(buttonId).classList.remove("focusButton");
}

function enableCompute(buttonId="compute") {
    document.getElementById(buttonId).classList.remove("disabledButton");
    document.getElementById(buttonId).classList.add("focusButton");
}

document.getElementById("compute").addEventListener("mousedown", function (e) {
    if (!document.getElementById("compute").classList.contains("disabledButton")) {
        disableCompute();
        document.getElementById("stackingSettings").scrollIntoView();
        computeAsync();
    }
});

document.getElementById("computeAnimation").addEventListener("mousedown", function (e) {
    if (!document.getElementById("computeAnimation").classList.contains("disabledButton")) {
        disableCompute();
        disableCompute("computeAnimation");
        disableCompute("newStack");
        document.getElementById("downloadAnimation").classList.add("disabledButton");
        document.getElementById("animationSettings").scrollIntoView();
        document.getElementById("computeAnimation").innerText = "Computing...";
        animate3d();
    }
});

document.getElementById("downloadStacked").addEventListener("mousedown", function (e) {
    if (!document.getElementById("downloadStacked").classList.contains("disabledButton")) {
        downloadCanvasPng(mainCanvas, "stacked");
    }
});

document.getElementById("downloadAnimation").addEventListener("mousedown", function (e) {
    if (animationCaptureStatus.result !== null) {
        let a = document.createElement("a");
        a.href = animationCaptureStatus.result;
        a.download = "animation.webm";
        a.click();
        a.remove();
    }
});

document.getElementById("downloadDepth").addEventListener("mousedown", function (e) {
    if (!document.getElementById("downloadDepth").classList.contains("disabledButton")) {
        downloadCanvasPng(document.getElementById("depthMap"), "depth");
    }
});

document.getElementById("downloadStereo").addEventListener("mousedown", function (e) {
    if (!document.getElementById("downloadStereo").classList.contains("disabledButton")) {
        let combinedCanvas = new OffscreenCanvas(mainCanvas.width * 2, mainCanvas.height);
        let combinedCtx = combinedCanvas.getContext("2d");
        combinedCanvas.width = mainCanvas.width * 2;
        combinedCanvas.height = mainCanvas.height;
        combinedCtx.drawImage(document.getElementById("leftImage"), 0, 0, mainCanvas.width, mainCanvas.height);
        combinedCtx.drawImage(document.getElementById("rightImage"), mainCanvas.width, 0, mainCanvas.width, mainCanvas.height);
        downloadCanvasPng(combinedCanvas, "stereo_combined");
    }
});

document.getElementById("downloadStereoLeft").addEventListener("mousedown", function (e) {
    if (!document.getElementById("downloadStereoLeft").classList.contains("disabledButton")) {
        downloadCanvasPng(document.getElementById("leftImage"), "stereo_left");
    }
});

document.getElementById("downloadStereoRight").addEventListener("mousedown", function (e) {
    if (!document.getElementById("downloadStereoRight").classList.contains("disabledButton")) {
        downloadCanvasPng(document.getElementById("rightImage"), "stereo_right");
    }
});

document.getElementById("downloadAnaglyph").addEventListener("mousedown", function (e) {
    if (!document.getElementById("downloadAnaglyph").classList.contains("disabledButton")) {
        downloadCanvasPng(document.getElementById("anaglyph"), "anaglyph");
    }
});

function downloadCanvasPng(canvas, filename) {
    new Promise((resolve, reject) => {
        if (typeof canvas.toDataURL !== "function") {
            canvas.convertToBlob().then((blob) => {
                resolve(URL.createObjectURL(blob));
            });
        } else {
            resolve(canvas.toDataURL("image/png"));
        }
    }).then((url) => {
        let a = document.createElement("a");
        a.href = url;
        a.download = filename + ".png";
        a.click();
        a.remove();
    });
}

function animate3d() {
    if (animationCaptureStatus.computing === false) {
        animationCaptureStatus.targetFrames = 30 / animationSettings.speed;
        animationCaptureStatus.frames = [];
        animationCaptureStatus.computing = true;
        animationCaptureStatus.result = null;
    }
    if (animationCaptureStatus.frames.length < animationCaptureStatus.targetFrames) {
        drawAnimationFrame();
        requestAnimationFrame(animate3d);
    } else {
        animationCaptureStatus.computing = false;
        setTimeout(captureAnimation, 500);
    }
}

function animate() {
    if (animationCaptureStatus.animateId !== null) {
        animationCtx.putImageData(animationCaptureStatus.frames[animationCaptureStatus.currentFrame%animationCaptureStatus.frames.length], 0, 0);
        animationCaptureStatus.currentFrame++;
    }
}

function captureAnimation() {
    let videoStream = animationCanvas.captureStream(30);
    let mediaRecorder = new MediaRecorder(videoStream, { mimeType: "video/webm" , videoBitsPerSecond: 48000000});
    let data = [];
    mediaRecorder.ondataavailable = function (e) {
        data.push(e.data);
    };
    mediaRecorder.onstop = function (e) {
        let blob = new Blob(data, { type: "video/webm" });
        animationCaptureStatus.result = URL.createObjectURL(blob);
    };
    animationCaptureStatus.currentFrame = 0;
    if (animationCaptureStatus.animateId !== null) {
        clearInterval(animationCaptureStatus.animateId);
    }
    animationCaptureStatus.animateId = setInterval(animate, 1000 / 30);
    settingsUI.disableAll();

    setTimeout(() => {
        mediaRecorder.start();
        document.getElementById("computeAnimation").innerText = "Recording " + ((8 / animationSettings.speed) | 0) + " seconds...";
        setTimeout(() => {
            mediaRecorder.stop();
            document.getElementById("computeAnimation").innerText = "Compute Animation";
            enableCompute();
            enableCompute("computeAnimation");
            enableCompute("newStack");
            document.getElementById("downloadAnimation").classList.remove("disabledButton");
            settingsUI.enableAll();
        }, 8 * 1000 / animationSettings.speed);
    }, 2 * 1000 / animationSettings.speed);
}

function drawAnimationFrame() {
    const duration = 30 / animationSettings.speed;
    const time = animationCaptureStatus.frames.length / duration;
    drawEye(Math.sin(time * Math.PI * 2) * animationSettings.strength / 100.0, animationCtx.canvas);
    animationCaptureStatus.frames.push(animationCtx.getImageData(0, 0, animationCtx.canvas.width, animationCtx.canvas.height));
}

function computeAsync() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            drawStacked().then(() => {
                drawDepthMapAsync().then(() => {
                    drawEyesAsync().then(() => {
                        drawAnaglyphsAsync().then(() => {
                            enableCompute();
                            resolve();
                        });
                        enableCompute("computeAnimation");
                    });
                });
            });
        }, 0);
    });
}

function handleImages(e) {
    let files = e.target.files;
    loadImages(files).then((images) => {
        for (let image of images) {
            let img = image.img;
            let file = image.file;
            addImage({
                name: file.name,
                img: img,
                imgContainer: null,
                originalData: null,
                differenceOfGaussian: null,
                statusText: null});
        }
        enableCompute();
    });
}

function loadImages(files) {
    return new Promise((resolve, reject) => {
        let images = [];
        for (let i = 0; i < files.length; i++) {
            let img = new Image();
            img.onload = function () {
                images.push({file: files[i], img: img});
                if (images.length === files.length) {
                    resolve(images);
                }
            }
            img.src = URL.createObjectURL(files[i]);
        }
    });
}

function removeImage(image) {
    let index = stackingData.imageSet.indexOf(image);
    if (index !== -1) {
        stackingData.imageSet.splice(index, 1);
        updateImagesDiv();
    }
    if (stackingData.imageSet.length === 0) {
        clearImages();
    }
}

function addImage(image) {
    if (image.originalData !== null && image.differenceOfGaussian !== null) {
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
        let sA = toStdSize(stackingSettings.sigmaA, mainCanvas.width);
        let sB = toStdSize(stackingSettings.sigmaB, mainCanvas.width);
        mainCanvasCtx.putImageData(differenceOfGaussian(image.originalData, sA, sB), 0, 0);
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
        let data = imageSet[i].differenceOfGaussian.data;
        let dataWidth = imageSet[i].differenceOfGaussian.width;
        for (let k = 0; k < 3; k++) {
            weight[k] += Math.abs(data[(y * dataWidth + x) * 4]) + bottomBias + topBias;
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
    if (imageSet[i].differenceOfGaussian === null) {
        let sA = toStdSize(stackingSettings.sigmaA, imageSet[i].img.width);
        let sB = toStdSize(stackingSettings.sigmaB, imageSet[i].img.width);
        imageSet[i].differenceOfGaussian = differenceOfGaussian(imageSet[i].originalData, sA, sB);
    }
    drawStatus("Processed: " + (i + 1) + "/" + imageSet.length);
    if (i === imageSet.length - 1) {
        setTimeout(after, 0);
    } else {
        setTimeout(() => updateDifferenceOfGaussian(i + 1, after), 0);
    }
}

function isLitteEndian() {
    let buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
}

function renormalizeDepthMap(depthMapCtx) {
    let depthMapData = depthMapCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    let depthMap = depthMapData.data;
    let maximumDepth = 0;
    let minimumDepth = 255;
    let pixelCount = mainCanvas.width * mainCanvas.height;
    for (let i = 0; i < pixelCount; i++) {
        let depth = depthMap[i * 4];
        if (depth > maximumDepth) {
            maximumDepth = depth;
        }
        if (depth < minimumDepth) {
            minimumDepth = depth;
        }
    }
    let depthRange = maximumDepth - minimumDepth;
    for (let i = 0; i < pixelCount; i++) {
        let depth = depthMap[i * 4];
        let normalizedDepth = (depth - minimumDepth) * 255 / depthRange;
        depthMap[i * 4] = normalizedDepth;
        depthMap[i * 4 + 1] = normalizedDepth;
        depthMap[i * 4 + 2] = normalizedDepth;
    }
    depthMapCtx.putImageData(depthMapData, 0, 0);
}

function drawDepthMapAsync() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            drawLoadingStatus(document.getElementById("depthMap"), mainCanvas.width, mainCanvas.height);
            setTimeout(() => {
                drawDepthMap();
                resolve();
            }, 0)
        }, 0);
    });
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
            let gammaCorrectedDepth = gammaCorrection(depth, anaglyphSettings.depthGamma, 1.0);
            for (let k = 0; k < 3; k++) {
                depthMap[(i * mainCanvas.width + j) * 4 + k] = (gammaCorrectedDepth * 255) | 0;
            }
            depthMap[(i * mainCanvas.width + j) * 4 + 3] = 255;
        }
    }
    originalDepthMapCtx.putImageData(depthMapData, 0, 0);
    depthMapCtx.clearRect(0, 0, depthMapCanvas.width, depthMapCanvas.height);
    depthMapCtx.filter = "blur(" + (toStdSize(anaglyphSettings.depthSmooth, mainCanvas.width)) + "px)";
    depthMapCtx.drawImage(originalDepthMapCanvas, 0, 0, depthMapCanvas.width, depthMapCanvas.height);
    renormalizeDepthMap(depthMapCtx);
    statusData.depthComputed = true;
    document.getElementById("downloadDepth").classList.remove("disabledButton");
}

function drawAnaglyphsAsync() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            drawLoadingStatus(document.getElementById("anaglyph"), mainCanvas.width, mainCanvas.height);
            setTimeout(() => {
                drawAnaglyph();
                resolve();
            }, 0);
        }, 0);
    });
}

function drawEyesAsync() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            drawLoadingStatus(document.getElementById("leftImage"), mainCanvas.width, mainCanvas.height);
            setTimeout(() => {
                drawEye(1.0, document.getElementById("leftImage"));
                document.getElementById("downloadStereoLeft").classList.remove("disabledButton");
                drawLoadingStatus(document.getElementById("rightImage"), mainCanvas.width, mainCanvas.height);
                setTimeout(() => {
                    drawEye(-1.0, document.getElementById("rightImage"));
                    document.getElementById("downloadStereoRight").classList.remove("disabledButton");
                    statusData.eyesComputed = true;
                    document.getElementById("downloadStereo").classList.remove("disabledButton");
                    resolve();
                }, 0);
            }, 0);
        }, 0);
    });
}

function drawEye(factor, canvasObject) {
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
    let dF = factor * toStdSize(anaglyphSettings.depthScale, mainCanvas.width);
    let dO = anaglyphSettings.depthOffset;
    for (let i = 0; i < canvasObject.height; i++) {
        for (let j = 0; j < canvasObject.width; j++) {
            let depth = dF * ((depthData[(i * mainCanvas.width + j) * 4] / 255) + dO);
            let x = (j + depth) | 0;
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

function gammaCorrection(intensity, gamma, scale=255) {
    return Math.pow(intensity / scale, 1 / gamma) * scale;
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
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 0] = Math.max(0, Math.min(255, redChannel));
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 1] = Math.max(0, Math.min(255, greenChannel));
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 2] = Math.max(0, Math.min(255, blueChannel));
            anaglyph[(i * anaglyphCanvas.width + j) * 4 + 3] = 255;
        }
    }
    anaglyphCtx.putImageData(anaglyphData, 0, 0);
    statusData.anaglyphComputed = true;
    document.getElementById("downloadAnaglyph").classList.remove("disabledButton");
}

function drawStacked() {
    return new Promise((resolve, reject) => {
        let imageSet = stackingData.imageSet;
        if (imageSet.length === 0)
            return;
        mainCanvas.width = imageSet[0].img.width;
        mainCanvas.height = imageSet[0].img.height;
        mainCanvasCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        initializeDepths(mainCanvas.width, mainCanvas.height);
        setTimeout(() => updateDifferenceOfGaussian(0, () => {
            let imageData = mainCanvasCtx.createImageData(mainCanvas.width, mainCanvas.height);
            setTimeout(() => drawStackedChunk(imageData, 0, Math.max(1, (mainCanvas.width / 100) | 0), resolve), 0);
        }), 0);
    }).then(() => {
        statusData.stackComputed = true;
        document.getElementById("downloadStacked").classList.remove("disabledButton");
    });
}

function drawStackedChunk(imageData, x1, x2, done) {
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
        statusData.stackComputed = true;
        done();
    } else {
        setTimeout(() => drawStackedChunk(imageData, x2, Math.min(x2 + (x2 - x1), mainCanvas.width), done), 0);
    }
}

function drawLoadingStatus(targetCanvas, width, height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
    let ctx = targetCanvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "120px Arial";
    let metrics = ctx.measureText("Loading...");
    let textWidth = metrics.width;
    ctx.fillText("Loading...", (width - textWidth) / 2, height / 2);
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