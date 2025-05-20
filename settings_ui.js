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

function SettingHandler(stackingSettings, anaglyphSettings, animationSettings, refreshAll, refreshDepth, refreshEyes, refreshAnaglyph) {

    function clamp(min, max, value) {
        return Math.min(Math.max(min, +value), max);
    }

    const anaglyphMatrices = {
        redCyanBest3D: {
            left: [
                [0.7, 0.3, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0]],
            right: [
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0]]
        },
        redCyanHalfColor: {
            left: [
                [0.3, 0.6, 0.1],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0]],
            right: [
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0]]
        },
        redCyanFullColor: {
            left: [
                [1.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0]],
            right: [
                [0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0]]
        },
        redCyanGray: {
            left: [
                [0.3, 0.6, 0.1],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0]],
            right: [
                [0.0, 0.0, 0.0],
                [0.3, 0.6, 0.1],
                [0.3, 0.6, 0.1]]
        },
        redCyanPureDark: {
            left: [
                [0.3, 0.6, 0.1],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0]],
            right: [
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.3, 0.6, 0.1]]
        }
    };

    const findAnaglyphType = function(leftMatrix, rightMatrix) {
        for (let key in anaglyphMatrices) {
            if (anaglyphMatrices.hasOwnProperty(key)) {
                let matrix = anaglyphMatrices[key];
                let same = true;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        if (Math.abs(matrix.left[i][j] - leftMatrix[i][j]) > 0.001 || Math.abs(matrix.right[i][j] - rightMatrix[i][j]) > 0.001) {
                            same = false;
                        }
                    }
                }
                if (same) {
                    return key;
                }
            }
        }
        return "customAnaglyph";
    };

    const showMatrices = function(show) {
        document.getElementById("leftCustomMatrix").parentNode.style.display = show ? "block" : "none";
        document.getElementById("rightCustomMatrix").parentNode.style.display = show ? "block" : "none";
    };

    return {
        registerUIEvents: function() {
            document.getElementById("invertImages").addEventListener("change", function() {
                stackingSettings.invertImages = this.checked;
                refreshAll();
            });
            document.getElementById("sharpness").addEventListener("change", function() {
                let featureScale = clamp(1, 100, document.getElementById("featureScale").value) / 10.0;
                stackingSettings.sigmaA = 100.0 / clamp(1, 100, this.value);
                stackingSettings.sigmaB = stackingSettings.sigmaA * featureScale;
                refreshAll();
            });
            document.getElementById("featureScale").addEventListener("change", function() {
                let featureScale = clamp(1, 100, this.value) / 10.0;
                stackingSettings.sigmaB = stackingSettings.sigmaA * featureScale;
                refreshAll();
            });
            document.getElementById("anaglyphType").addEventListener("change", function() {
                if (this.value === "customAnaglyph") {
                    showMatrices(true);
                } else {
                    showMatrices(false);
                    anaglyphSettings.leftMatrix = anaglyphMatrices[this.value].left;
                    anaglyphSettings.rightMatrix = anaglyphMatrices[this.value].right;
                }
                refreshAnaglyph();
            });
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    document.getElementById("leftMatrix" + i + j).addEventListener("change", function() {
                        anaglyphSettings.leftMatrix[i][j] = clamp(0, 2, this.value);
                        refreshAnaglyph();
                    });
                    document.getElementById("rightMatrix" + i + j).addEventListener("change", function() {
                        anaglyphSettings.rightMatrix[i][j] = clamp(0, 2, this.value);
                        refreshAnaglyph();
                    });
                }
            }
            document.getElementById("anaglyphLeftGamma").addEventListener("change", function() {
                anaglyphSettings.leftGamma = clamp(0.1, 3.0, this.value);
                refreshAnaglyph();
            });
            document.getElementById("anaglyphRightGamma").addEventListener("change", function() {
                anaglyphSettings.rightGamma = clamp(0.1, 3.0, this.value);
                refreshAnaglyph();
            });
            document.getElementById("depthGamma").addEventListener("change", function() {
                anaglyphSettings.depthGamma = Math.pow(2, clamp(-6.0, 6.0, this.value));
                refreshDepth();
            });
            document.getElementById("depthScale").addEventListener("change", function() {
                anaglyphSettings.depthScale = clamp(0, 200, this.value);
                refreshEyes();
            });
            document.getElementById("depthOffset").addEventListener("change", function() {
                anaglyphSettings.depthOffset = clamp(-100, 0, this.value) / 100.0;
                refreshEyes();
            });
            document.getElementById("depthSmooth").addEventListener("change", function() {
                anaglyphSettings.depthSmooth = clamp(0, 100, this.value);
                refreshDepth();
            });
            document.getElementById("animationSpeed").addEventListener("change", function() {
                animationSettings.speed = clamp(25, 200, this.value) / 100.0;
            });
            document.getElementById("animationStrength").addEventListener("change", function() {
                animationSettings.strength = clamp(0, 100, this.value);
            });
            document.getElementById("useDepthMap").addEventListener("change", function() {
                stackingSettings.useDepthMap = this.checked;
            });
        },
        updateUIValues: function() {
            document.getElementById("invertImages").checked = stackingSettings.invertImages;
            document.getElementById("sharpness").value = 100.0 / stackingSettings.sigmaA;
            document.getElementById("featureScale").value = stackingSettings.sigmaB / stackingSettings.sigmaA * 10.0;
            let anaglyphType = findAnaglyphType(anaglyphSettings.leftMatrix, anaglyphSettings.rightMatrix);
            document.getElementById("anaglyphType").value = anaglyphType;
            showMatrices(anaglyphType === "customAnaglyph");
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    document.getElementById("leftMatrix" + i + j).value = anaglyphSettings.leftMatrix[i][j];
                    document.getElementById("rightMatrix" + i + j).value = anaglyphSettings.rightMatrix[i][j];
                }
            }
            document.getElementById("anaglyphLeftGamma").value = anaglyphSettings.leftGamma;
            document.getElementById("anaglyphRightGamma").value = anaglyphSettings.rightGamma;
            document.getElementById("depthGamma").value = Math.log2(anaglyphSettings.depthGamma);
            document.getElementById("depthScale").value = anaglyphSettings.depthScale;
            document.getElementById("depthOffset").value = anaglyphSettings.depthOffset * 100.0;
            document.getElementById("depthSmooth").value = anaglyphSettings.depthSmooth;
            document.getElementById("animationSpeed").value = animationSettings.speed * 100.0;
            document.getElementById("animationStrength").value = animationSettings.strength;
            document.getElementById("useDepthMap").checked = stackingSettings.useDepthMap;
        },
        disableAll: function() {
            let settings = document.getElementsByClassName("settingsValue");
            for (let i = 0; i < settings.length; i++) {
                settings[i].disabled = true;
            }
        },
        enableAll: function() {
            let settings = document.getElementsByClassName("settingsValue");
            for (let i = 0; i < settings.length; i++) {
                settings[i].disabled = false;
            }
        }
    }
}