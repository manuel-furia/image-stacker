let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d")
let imgs = [];
let oimgs = [];
let cimgs = [];
let imagesDiv = document.getElementById("images");

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
            imgs.push(img);
            refreshImages();
        }
        img.src = URL.createObjectURL(files[i]);
    }
}

function refreshImages() {
    imagesDiv.innerHTML = "";
    cimgs = [];
    oimgs = [];
    for (let i = 0; i < imgs.length; i++) {
        let originalWidth = imgs[i].width;
        let originalHeight = imgs[i].height;
        let ratio = originalWidth / originalHeight;
        let img = document.createElement("img");
        img.src = imgs[i].src;
        let newWidth = originalWidth;
        let newHeight = newWidth / ratio;
        let imgStyleWidth = 400;
        let imgStyleHeight = imgStyleWidth / ratio;
        img.style.width = imgStyleWidth + "px";
        img.style.height = imgStyleHeight + "px";
        imagesDiv.appendChild(img);
        let tempCanvas = new OffscreenCanvas(newWidth, newHeight);
        let tempCtx = tempCanvas.getContext("2d");
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        tempCtx.drawImage(imgs[i], 0, 0, newWidth, newHeight);
        let imageData = tempCtx.getImageData(0, 0, newWidth, newHeight);
        cimgs.push(convolution(imageData, laplacianOfGaussianKernel(15, 1.0)));
        tempCanvas.width = originalWidth;
        tempCanvas.height = originalHeight;
        tempCtx.drawImage(imgs[i], 0, 0, originalWidth, originalHeight);
        oimgs.push(tempCtx.getImageData(0, 0, originalWidth, originalHeight));
        img.onclick = function () {
            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.putImageData(cimgs[i], 0, 0);
        }
    }
}

function focusWeight(s) {
    let weights = [];
    if (cimgs.length === 0)
        return;
    for (let i = 0; i < cimgs[0].width; i++) {
        weights[i] = [];
        for (let j = 0; j < cimgs[0].height; j++) {
            weights[i][j] = [];
            for (let w = 0; w < cimgs.length; w++) {
                weights[i][j][w] = 0;
            }
        }
    }
    for (let x = 0; x < cimgs[0].width; x++) {
        for (let y = 0; y < cimgs[0].height; y++) {
            let sum = 0;
            for (let i = 0; i < cimgs.length; i++) {
                let data = cimgs[i].data;
                let allChannels = 0;
                for (let j = 0; j < 3; j++) {
                    allChannels += data[(y * cimgs[i].width + x) * 4 + j] / (255 * 3);
                }
                weights[x][y][i] += Math.pow(allChannels, 8);
                sum += weights[x][y][i];
            }
            if (sum === 0) {
                weights[x][y][0] = 1.0;
            } else {
                for (let i = 0; i < cimgs.length; i++) {
                    weights[x][y][i] /= sum;
                }
            }
        }
    }
         
    return weights;
}

function mixWithWeights(inputs, weights, x, y) {
    let result = [];
    for (let i = 0; i < 3; i++)
        result[i] = 0;
    result[3] = 255;
    for (let i = 0; i < inputs.length; i++) {
        for (let j = 0; j < 3; j++) {
            let v = inputs[i].data[(y * inputs[i].width + x) * 4 + j];
            let w = weights[i];
            result[j] += (v * w) | 0;
        }
            
    }
    return result;
}

function drawStacked() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imgs.length === 0 || cimgs.length === 0 || oimgs.length === 0)
        return;
    canvas.width = imgs[0].width;
    canvas.height = imgs[0].height;
    let imageData = ctx.createImageData(canvas.width, canvas.height);
    let weights = focusWeight(0.05);
    setTimeout(() => drawStackedChunk(imageData, weights, 0, Math.max(1, (canvas.width / 100) | 0)), 0);
}

function drawStackedChunk(imageData, weights, x1, x2) {
    let data = imageData.data;
    for (let x = x1; x < x2; x++) {
        let xScaled = (weights.length * x / canvas.width) | 0;
        for (let y = 0; y < canvas.height; y++) {
            let yScaled = (weights[xScaled].length * y / canvas.height) | 0;
            let currentWeights = weights[xScaled][yScaled];
            let mixed = mixWithWeights(oimgs, currentWeights, x, y);
            for (let k = 0; k < 4; k++)
                data[(y * canvas.width + x) * 4 + k] = mixed[k];
        }
    }
    // Draw percentage progress
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "120px Arial";
    ctx.fillText((100 * x1 / canvas.width).toFixed(0) + "%", (canvas.width - 120) / 2, canvas.height / 2);
    if (x2 === canvas.width) {
        ctx.putImageData(imageData, 0, 0);
    } else {
        setTimeout(() => drawStackedChunk(imageData, weights, x2, Math.min(x2 + (x2 - x1), canvas.width)), 0);
    }
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