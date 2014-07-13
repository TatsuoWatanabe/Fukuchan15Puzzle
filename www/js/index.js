/*
* Copyright (c) 2014 Tatsuo Watanabe
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/
/// <reference path="typings/jquery.d.ts" />
/// <reference path="typings/moment.d.ts" />
/// <reference path="typings/createjs/createjs.d.ts" />
/// <reference path="typings/rgbcolor.d.ts" />
var Block = (function () {
    function Block(_position, bitmap) {
        this._position = _position;
        this.bitmap = bitmap;
        this.imgPosition = _position;
    }
    Object.defineProperty(Block.prototype, "position", {
        get: function () {
            return this._position;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Block.prototype, "isCorrect", {
        get: function () {
            return this.imgPosition === this.position;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Block.prototype, "isBlank", {
        get: function () {
            return !this.bitmap.visible;
        },
        set: function (f) {
            this.bitmap.visible = !f;
        },
        enumerable: true,
        configurable: true
    });
    Block.swapProperties = function (block1, block2) {
        var temporaryValues = {
            bitmap: block1.bitmap,
            imgPosition: block1.imgPosition,
            isBlank: block1.isBlank
        };
        block1.bitmap = block2.bitmap;
        block1.imgPosition = block2.imgPosition;
        block1.isBlank = block2.isBlank;
        block2.bitmap = temporaryValues.bitmap;
        block2.imgPosition = temporaryValues.imgPosition;
        block2.isBlank = temporaryValues.isBlank;
    };
    return Block;
})();

var FifteenPuzzle = (function () {
    function FifteenPuzzle(canvas, onShuffle) {
        this.canvas = canvas;
        this.onShuffle = onShuffle;
        this.isLocked = false;
        this.UDLR = [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0]
        ];
        this.stage = new createjs.Stage(this.canvas);
        createjs.Ticker.setFPS(60);
        createjs.Ticker.addEventListener('tick', this.stage);

        this.bgColor = this.getRandomColor();
        canvas.onmousedown = this.getMouseHandlerFunction();
        moment.lang('ja');
    }
    // 15パズルを開始します。
    FifteenPuzzle.prototype.initGame = function (imgSrc, rowCount) {
        var _this = this;
        if (typeof rowCount === "undefined") { rowCount = 4; }
        if (this.isLocked) {
            return;
        }
        this.rowCount = this.colCount = rowCount;
        this.numBlocks = this.rowCount * this.colCount;
        this.moveCount = 0;
        this.initMoment = moment();
        this.image = new Image();
        this.image.src = imgSrc;
        this.image.onload = function () {
            return _this.initImageLoaded();
        };
    };

    // 画像読込時に実行されるメソッドです。
    FifteenPuzzle.prototype.initImageLoaded = function () {
        var _this = this;
        this.blockWidth = this.image.width / this.colCount;
        this.blockHeight = this.image.height / this.rowCount;
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.stage.removeAllChildren();
        this.stage.clear();

        // set background to stage
        this.stage.addChild(new createjs.Shape((new createjs.Graphics()).beginFill(this.bgColor).drawRect(0, 0, this.canvas.width, this.canvas.height)));
        this.isLocked = true;

        // パズルのブロックを作成
        this.blocks = [];
        var blockLabelColor = this.getRandomColor(true);
        for (var i = 0; i < this.numBlocks; i++) {
            var p = this.getCoordinates(i);
            var dividedImageDataURL = (function (img, w, h) {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var lineWidth = 0.5;
                var fontSize = Math.floor(w / 1.3);
                var labelText = String(i + 1);
                canvas.width = w;
                canvas.height = h;

                // draw the part of image
                ctx.drawImage(img, p.x, p.y, w, h, 0, 0, w - lineWidth, h - lineWidth);

                // draw the block label
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = blockLabelColor;
                ctx.font = 'bold ' + String(fontSize) + 'px Arial';
                ctx.fillText(labelText, (w - fontSize) / labelText.length, fontSize);
                return canvas.toDataURL("image/png");
            })(this.image, this.blockWidth, this.blockHeight);
            var bm = new createjs.Bitmap(dividedImageDataURL);
            bm.setTransform(p.x, p.y);
            this.stage.addChild(bm);
            this.blocks[i] = new Block(i, bm);
            this.blocks[i].isBlank = (i === this.numBlocks - 1); // 末尾(右下)を空きブロックとする
        }

        // 1秒後にシャッフルを開始する
        setTimeout(function () {
            _this.shufflePazzle(50 * _this.rowCount, function () {
                _this.isLocked = false; /*ゲーム開始*/ 
            });
        }, 1000);
    };

    // クリック時に実行する関数を返します。
    FifteenPuzzle.prototype.getMouseHandlerFunction = function () {
        var _this = this;
        return function (e) {
            var currentTarget = e.currentTarget;
            var col = Math.floor((e.offsetX || e.layerX - currentTarget.offsetLeft) / _this.blockWidth);
            var row = Math.floor((e.offsetY || e.layerY - currentTarget.offsetTop) / _this.blockHeight);
            if (_this.isLocked || _this.isOutOfRange(col, row)) {
                return;
            }

            // 動かすべきブロックを取得
            var sourceBlock = _this.getBlockByColRow(col, row);
            if (sourceBlock.isBlank) {
                return;
            }

            // 動かせる方向があれば動かす
            _this.UDLR.forEach(function (direction) {
                var targetCol = col + direction[0];
                var targetRow = row + direction[1];
                if (!_this.isOutOfRange(targetCol, targetRow) && _this.getBlockByColRow(targetCol, targetRow).isBlank) {
                    _this.move(sourceBlock, function () {
                        _this.moveCount += 1;
                        _this.checkClear();
                    });
                }
            });
        };
    };

    // 動かせるブロックをランダムに1つ返します。
    FifteenPuzzle.prototype.getRandomMovableBlock = function () {
        var direction = this.UDLR[this.rnd(this.UDLR.length)];
        var blankBlock = this.getBlankBlock();
        var targetCol = this.getCol(blankBlock.position) + direction[0];
        var targetRow = this.getRow(blankBlock.position) + direction[1];
        return this.isOutOfRange(targetCol, targetRow) ? this.getRandomMovableBlock() : this.getBlockByColRow(targetCol, targetRow);
    };

    // 引数countの回数だけランダムにブロックを動かします。
    FifteenPuzzle.prototype.shufflePazzle = function (count, onComplete) {
        var _this = this;
        var suffle = function () {
            if (count < 0) {
                count = 1;
            }
            if (count -= 1) {
                _this.move(_this.getRandomMovableBlock(), function () {
                    suffle();
                    _this.onShuffle(count);
                }, 0);
            } else {
                onComplete();
            }
        };
        suffle();
    };

    // 色名をランダムに一つ返します。
    FifteenPuzzle.prototype.getRandomColor = function (toRGB) {
        if (typeof toRGB === "undefined") { toRGB = false; }
        var colors = ['Blue', 'Green', 'Saddlebrown', 'DeepSkyBlue', 'SeaGreen', 'Pink', 'Silver', 'FireBrick', 'Linen'];
        var colorName = colors[this.rnd(colors.length)];
        var rgbColor = new RGBColor(colorName);
        return toRGB ? rgbColor.toRGB() : colorName;
    };

    // クリアしたかどうかをチェックします。
    FifteenPuzzle.prototype.checkClear = function () {
        var isCleared = this.blocks.every(function (block) {
            return block.isCorrect;
        });
        if (isCleared) {
            var m = moment();
            var min = m.diff(this.initMoment, 'minutes');
            var sec = m.diff(this.initMoment, 'seconds');
            this.getBlankBlock().isBlank = false;
            this.stage.removeAllChildren();
            this.stage.clear();
            this.stage.addChild(new createjs.Bitmap(this.image));
            this.stage.update();
            alert('完成！\n\n' + 'かかった手数: ' + this.moveCount + '手\n' + 'かかった時間: ' + min + '分' + ('0' + (sec - min * 60)).slice(-2) + '秒');
            this.stage.update();
        }
    };

    // 指定したブロックNoのブロックを動かします。
    FifteenPuzzle.prototype.move = function (sourceBlock, callback, duration) {
        if (typeof duration === "undefined") { duration = 200; }
        var blankBlock = this.getBlankBlock();

        // move the block bitmap
        createjs.Tween.get(sourceBlock.bitmap).to(this.getCoordinates(blankBlock.position), duration).set(this.getCoordinates(sourceBlock.position), blankBlock.bitmap).call(function () {
            if (callback) {
                setTimeout(function () {
                    return callback();
                }, duration);
            }
        });

        // swap the block image position info
        Block.swapProperties(sourceBlock, blankBlock);
    };

    // ブロック番号からx,y座標を取得します。
    FifteenPuzzle.prototype.getCoordinates = function (no) {
        return {
            x: this.getCol(no) * this.blockWidth,
            y: this.getRow(no) * this.blockHeight
        };
    };

    // 列と行の対象が範囲外かどうかの真偽値を返します。
    FifteenPuzzle.prototype.isOutOfRange = function (col, row) {
        return (col < 0 || col >= this.colCount || row < 0 || row >= this.rowCount);
    };

    // 列と行からブロックを返します。
    FifteenPuzzle.prototype.getBlockByColRow = function (col, row) {
        if (this.isOutOfRange(col, row)) {
            throw ('column or row is out of range.');
        }
        return this.blocks[row * this.colCount + col];
    };

    // 空きブロックを返します。
    FifteenPuzzle.prototype.getBlankBlock = function () {
        return this.blocks.filter(function (block) {
            return block.isBlank;
        })[0];
    };

    // ランダムな整数を返します。
    FifteenPuzzle.prototype.rnd = function (max) {
        return Math.floor(Math.random() * max);
    };

    // ブロック番号から列番号を返します。
    FifteenPuzzle.prototype.getCol = function (no) {
        return no % this.colCount;
    };

    // ブロック番号から行番号を返します。
    FifteenPuzzle.prototype.getRow = function (no) {
        return Math.floor(no / this.colCount);
    };
    return FifteenPuzzle;
})();

if (!window.alert && Windows && Windows.UI) {
    window.alert = function (message) {
        var msgBox = new Windows.UI.Popups.MessageDialog(message);
        msgBox.showAsync();
    };
}

// -----------------------
var app = {
    // Application Constructor
    initialize: function () {
        this.bindEvents();
        $(function () {
            var canvas = document.getElementById('canvas');
            var puzzle = new FifteenPuzzle(canvas, function (n) {
                $('#status').text(n > 5 ? n + ' Shuffling ' + '..........'.slice(n % 10) : '');
            });
            var reset = function () {
                var imgDir = (function (no) {
                    return 'img/' + ((no === '3') ? 'fukuchan03' : (no === '2') ? 'fukuchan02' : 'fukuchan01') + '/';
                })($('#selectedImage').val());
                var imgSrc = (function (shortSide) {
                    return imgDir + ((shortSide >= 1200) ? '1200.jpg' : (shortSide >= 800) ? '800.jpg' : (shortSide >= 600) ? '600.jpg' : '480.jpg');
                })(window.innerWidth > window.innerHeight ? window.innerHeight : window.innerWidth);
                puzzle.initGame(imgSrc, $('#puzzleSize').val());
            };
            $('#btnReset').on('click', function () {
                reset();
            }).click();
        });
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function () {
    },
    // Update DOM on a Received Event
    receivedEvent: function () {
    }
};
//# sourceMappingURL=index.js.map
