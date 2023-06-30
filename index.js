let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d")
let imageSet = [];

let imagesDiv = document.getElementById("images");
let stackingSettings = {
    kernelSize: 5,
    sigmaA: 1.0,
    sigmaB: 2.0,
    logScale: 1.0
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
            addImage({img: img, originalData: null, laplacianOfGaussianData: null, statusText: null});
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
    if (image.originalData !== null && image.laplacianOfGaussianData !== null) {
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
        ctx.putImageData(differenceOfGaussian(image, 1.0, 2.0), 0, 0);
    }
    let tempCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    let tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    tempCtx.drawImage(image.img, 0, 0, originalWidth, originalHeight);
    image.originalData = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
}

function differenceOfGaussian(image, s1, s2) {
    let originalWidth = image.img.width;
    let originalHeight = image.img.height;
    let tempCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    let tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    tempCtx.filter = "blur(" + s1 + "px)";
    tempCtx.drawImage(image.img, 0, 0, originalWidth, originalHeight);
    let imageData1 = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
    tempCtx.filter = "blur(" + s2 + "px)";
    tempCtx.drawImage(image.img, 0, 0, originalWidth, originalHeight);
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

function computeWeights(x, y) {
    let weights = [];
    let sum = 0;
    let maxWeight = 0;
    let maxWeightIndex = 0;
    let minWeight = 1.0;
    let minWeightIndex = 0;

    for (let i = 0; i < imageSet.length; i++) {
        weights[i] = 0;
    }

    for (let i = 0; i < imageSet.length; i++) {
        let data = imageSet[i].laplacianOfGaussianData.data;
        let dataWidth = imageSet[i].laplacianOfGaussianData.width;
        let allChannels = 0;
        for (let j = 0; j < 3; j++) {
            allChannels += data[(y * dataWidth + x) * 4 + j] / (255 * 3);
        }
        let weight = Math.pow(allChannels, 8);
        sum += weight;
        if (weight > maxWeight) {
            maxWeight = weight;
            maxWeightIndex = i;
        }
        if (weight < minWeight) {
            minWeight = weight;
            minWeightIndex = i;
        }
        weights[i] = weight;
    }

    if (sum === 0) {
        weights[0] = 1.0;
    } else if (maxWeight < minWeight * 100000000) {
        for (let i = 0; i < imageSet.length; i++) {
            weights[i] = 0;
        }
        weights[minWeightIndex] = 1.0;
    } else {
        for (let i = 0; i < imageSet.length; i++) {
            weights[i] /= sum;
        }
    }

    return weights;
}

function mixWithWeights(x, y) {
    let result = [];
    for (let i = 0; i < 3; i++)
        result[i] = 0;
    result[3] = 255;
    let weights = computeWeights(x, y);
    for (let i = 0; i < imageSet.length; i++) {
        const imageWidth = imageSet[i].originalData.width;
        const originalData = imageSet[i].originalData.data;
        const weightForImage = weights[i];
        for (let j = 0; j < 3; j++) {
            const v = originalData[(y * imageWidth + x) * 4 + j];
            const w = weightForImage;
            result[j] += (v * w) | 0;
        }
            
    }
    return result;
}

function updateDifferenceOfGaussian(i, after) {
    if (imageSet[i].laplacianOfGaussianData === null) {
        imageSet[i].laplacianOfGaussianData = differenceOfGaussian(imageSet[i], stackingSettings.sigmaA, stackingSettings.sigmaB);
    }
    drawStatus("Processed: " + (i + 1) + "/" + imageSet.length);
    if (i === imageSet.length - 1) {
        setTimeout(after, 0);
    } else {
        setTimeout(() => updateDifferenceOfGaussian(i + 1, after), 0);
    }
}

function drawStacked() {
    if (imageSet.length === 0)
        return;
    canvas.width = imageSet[0].img.width;
    canvas.height = imageSet[0].img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => updateDifferenceOfGaussian(0, () => {
        let imageData = ctx.createImageData(canvas.width, canvas.height);
        setTimeout(() => drawStackedChunk(imageData, 0, Math.max(1, (canvas.width / 100) | 0)), 0);
    }), 0);
}

function drawStackedChunk(imageData, x1, x2) {
    let data = imageData.data;
    for (let x = x1; x < x2; x++) {
        let xScaled = (imageSet[0].laplacianOfGaussianData.width * x / canvas.width) | 0;
        for (let y = 0; y < canvas.height; y++) {
            let yScaled = (imageSet[0].laplacianOfGaussianData.height * y / canvas.height) | 0;
            let mixed = mixWithWeights(x, y);
            for (let k = 0; k < 4; k++)
                data[(y * canvas.width + x) * 4 + k] = mixed[k];
        }
    }
    // Draw percentage progress
    drawStatus("Stacking: " + (100 * x1 / canvas.width).toFixed(0) + "%");
    if (x2 === canvas.width) {
        ctx.putImageData(imageData, 0, 0);
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

function laplacianOfGaussianKernel(n, s) {
    let kernel = [];
    for (let i = 0; i < n; i++) {
        kernel[i] = [];
        for (let j = 0; j < n; j++) {
            kernel[i][j] = LoG(i - (n - 1) / 2, j - (n - 1) / 2, s);
        }
    }
    return kernel;
    
}

function convolution(imgData, kernel) {
    let n = kernel.length;
    let m = kernel[0].length;
    let data = imgData.data;
    let width = imgData.width;
    let height = imgData.height;
    let result = ctx.createImageData(width, height);
    let resultData = result.data;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++)
            for (let k = 0; k < 4; k++)
                resultData[(i * width + j) * 4 + k] = 0;
    }
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            for (let k = 0; k < 3; k++) {
                let sum = 0;
                for (let u = 0; u < n; u++)
                    for (let v = 0; v < m; v++) {
                        let x = i + u - (n - 1) / 2;
                        let y = j + v - (m - 1) / 2;
                        if (x >= 0 && x < height && y >= 0 && y < width)
                            sum += data[(x * width + y) * 4 + k] * kernel[u][v];
                    }
                resultData[(i * width + j) * 4 + k] = Math.abs(sum);
            }
            resultData[(i * width + j) * 4 + 3] = data[(i * width + j) * 4 + 3];
        }
    }
    return result;
}