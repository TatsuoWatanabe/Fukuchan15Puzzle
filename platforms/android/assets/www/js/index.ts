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
class Block {
    constructor(private _position: number, public bitmap: createjs.Bitmap, public text: createjs.Text) {
        this.imgPosition = _position;
    }
    public imgPosition: number;
    public get position() { return this._position; }
    public get label() { return String(this.imgPosition + 1); }
    public get isCorrect() { return this.imgPosition === this.position; }
    public get isBlank() { return !this.bitmap.visible }
    public set isBlank(f: boolean) { this.bitmap.visible = this.text.visible = !f;  }
}

class FifteenPuzzle {
    private image: HTMLImageElement;
    private stage: createjs.Stage;
    private rowCount: number;
    private colCount: number;
    private numBlocks: number;
    private moveCount: number;
    private initMoment: Moment;
    private blockWidth: number;
    private blockHeight: number;
    private blocks: Block[];
    private blankBgColor: string;
    private isLocked = false;  
    private UDLR = [
        [0, -1], // Up
        [0,  1], // Down
        [-1, 0], // Left
        [1,  0]  // Right
    ];

    constructor(private canvas: HTMLCanvasElement, private onShuffle?: (n: number) => void) {
        var colors = ['Blue', 'Green', 'Red', 'DeepSkyBlue', 'SeaGreen', 'Pink', 'Silver', 'FireBrick', 'Linen'];
        this.blankBgColor = colors[this.rnd(colors.length)];
        canvas.onmousedown = this.getMouseHandlerFunction();
        moment.lang('ja');
    }

    // 15パズルを開始します。
    public initGame(imgSrc: string, rowCount = 4) {
        if (this.isLocked) { return; }
        this.rowCount = this.colCount = rowCount;
        this.numBlocks = this.rowCount * this.colCount;
        this.moveCount = 0;
        this.initMoment = moment();
        this.image = new Image();
        this.image.src = imgSrc;
        this.image.onload = () => this.initImageLoaded();
    }

    // 画像読込時に実行されるメソッドです。
    private initImageLoaded() {
        this.blockWidth = this.image.width / this.colCount;
        this.blockHeight = this.image.height / this.rowCount;
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.stage = new createjs.Stage(this.canvas);
        // set background to stage
        this.stage.addChild(new createjs.Shape(
            (new createjs.Graphics()).beginFill(this.blankBgColor).drawRect(0, 0, this.canvas.width, this.canvas.height)
        ));
        createjs.Ticker.setFPS(60);
        createjs.Ticker.addEventListener('tick', <any>this.stage);

        this.isLocked = true;
        // パズルのブロックを作成
        this.blocks = [];
        for (var i = 0; i < this.numBlocks; i++) {
            var p = this.getCoordinates(i);
            var dividedImageDataURL = ((img: HTMLImageElement, w: number, h: number) => {
                var canvas = document.createElement('canvas');
                var lineWidth = 0.5;
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, p.x, p.y, w, h, 0, 0, w - lineWidth, h - lineWidth);
                return canvas.toDataURL("image/png");
            })(this.image, this.blockWidth, this.blockHeight);
            var bm = new createjs.Bitmap(dividedImageDataURL);
            bm.setTransform(p.x, p.y);

            var fontSize = Math.floor(this.blockWidth / 3);
            var txt = new createjs.Text(String(i + 1), 'bold ' + String(fontSize) + 'px Arial');
            txt.color = 'white';
            txt.alpha = 0.5;
            txt.setTransform(p.x + (this.blockWidth - fontSize) / 1.8, p.y + (this.blockHeight + fontSize / 2) / 3);
            
            this.stage.addChild(bm, txt);
            this.blocks[i] = new Block(i, bm, txt);
            this.blocks[i].isBlank = (i === this.numBlocks - 1); // 末尾(右下)を空きブロックとする
        }

        // 1秒後にシャッフルを開始する
        setTimeout(() => {
            this.shufflePazzle(50 * this.rowCount, () => { this.isLocked = false; /*ゲーム開始*/ });
        }, 1000);
    }

    // クリック時に実行する関数を返します。
    private getMouseHandlerFunction() {
        return (e: MouseEvent) => {
            var currentTarget: any = e.currentTarget;
            var col = Math.floor((e.offsetX || e.layerX - currentTarget.offsetLeft) / this.blockWidth);
            var row = Math.floor((e.offsetY || e.layerY - currentTarget.offsetTop) / this.blockHeight);
            if (this.isLocked || this.isOutOfRange(col, row)) { return; }

            // 動かすべきブロックを取得
            var sourceBlock = this.getBlockByColRow(col, row);
            if (sourceBlock.isBlank) { return; }

            // 動かせる方向があれば動かす
            this.UDLR.forEach((direction) => {
                var targetCol = col + direction[0];
                var targetRow = row + direction[1];
                if (!this.isOutOfRange(targetCol, targetRow) && this.getBlockByColRow(targetCol, targetRow).isBlank) {
                    this.move(sourceBlock, () => {
                        this.moveCount += 1;
                        this.checkClear();
                    });
                }
            });
        };
    }

    // 動かせるブロックをランダムに1つ返します。
    private getRandomMovableBlock() {
        var direction = this.UDLR[this.rnd(this.UDLR.length)];
        var blankBlock = this.getBlankBlock();
        var targetCol = this.getCol(blankBlock.position) + direction[0];
        var targetRow = this.getRow(blankBlock.position) + direction[1];
        return this.isOutOfRange(targetCol, targetRow) ?
            <Block>this.getRandomMovableBlock() :
            this.getBlockByColRow(targetCol, targetRow);
    }

    // 引数countの回数だけランダムにブロックを動かします。
    private shufflePazzle(count: number, onComplete?: () => void) {
        var suffle = () => {
            if (count < 0) { count = 1; }
            if (count -= 1) {
                this.move(this.getRandomMovableBlock(), () => {
                    suffle();
                    this.onShuffle(count);
                }, 0);
            } else { onComplete(); }
        };
        suffle();
    }

    // クリアしたかどうかをチェックします。
    private checkClear() {
        var isCleared = this.blocks.every(block => block.isCorrect);
        if (isCleared) {
            var m = moment();
            var min = m.diff(this.initMoment, 'minutes');
            var sec = m.diff(this.initMoment, 'seconds');
            this.getBlankBlock().isBlank = false;
            this.blocks.forEach((block) => block.isBlank = false);
            alert(
                '完成！\n\n' +
                'かかった手数: ' + this.moveCount + '手\n' +
                'かかった時間: ' + min + '分' + ('0' + (sec - min * 60)).slice(-2) + '秒'
            );
        }
    }

    // 指定したブロックNoのブロックを動かします。
    private move(sourceBlock: Block, callback?: () => void, duration = 200) {
        var blankBlock = this.getBlankBlock();
        var sourceImgPosition = sourceBlock.imgPosition;
        var sourceBitmap = sourceBlock.bitmap;
        var sourceText = sourceBlock.text;

        // move the block bitmap
        createjs.Tween.get(sourceBlock.bitmap)
            .to(this.getCoordinates(blankBlock.position), duration)
            .set(this.getCoordinates(sourceBlock.position), blankBlock.bitmap)
            .call(() => {
                if (callback) { callback(); }
            });

        // move the text
        createjs.Tween.get(sourceBlock.text)
             .to({ x: blankBlock.text.x, y: blankBlock.text.y }, duration)
             .set({ x: sourceBlock.text.x, y: sourceBlock.text.y }, blankBlock.text);

        sourceBlock.bitmap = blankBlock.bitmap;
        sourceBlock.text = blankBlock.text;
        sourceBlock.imgPosition = blankBlock.imgPosition;
        sourceBlock.isBlank = true;
        blankBlock.bitmap = sourceBitmap;
        blankBlock.text = sourceText;
        blankBlock.imgPosition = sourceImgPosition
        blankBlock.isBlank = false;
    }

    // ブロック番号からx,y座標を取得します。
    private getCoordinates(no: number) {
        return {
            x: this.getCol(no) * this.blockWidth,
            y: this.getRow(no) * this.blockHeight
        };
    }

    // 列と行の対象が範囲外かどうかの真偽値を返します。
    private isOutOfRange(col: number, row: number) {
        return (
            col < 0 || col >= this.colCount ||
            row < 0 || row >= this.rowCount
        );
    }

    // 列と行からブロックを返します。
    private getBlockByColRow(col: number, row: number) {
        if (this.isOutOfRange(col, row)) { throw ('column or row is out of range.'); }
        return this.blocks[row * this.colCount + col];
    }

    // 空きブロックを返します。
    private getBlankBlock() { return this.blocks.filter(block => block.isBlank)[0]; }
    // ランダムな整数を返します。
    private rnd(max: number) { return Math.floor(Math.random() * max); }
    // ブロック番号から列番号を返します。
    private getCol(no: number) { return no % this.colCount; }
    // ブロック番号から行番号を返します。
    private getRow(no: number) { return Math.floor(no / this.colCount); }
}

// --- for Windows app ---
declare var Windows: any;
if (!alert && Windows && Windows.UI) {
    function alert(message: string) {
        var msgBox = new Windows.UI.Popups.MessageDialog(message);
        msgBox.showAsync();
    }
}
// -----------------------

var app = {
    // Application Constructor
    initialize: function () {
        this.bindEvents();
        $(() => {
            var canvas = <HTMLCanvasElement>document.getElementById('canvas');
            var puzzle = new FifteenPuzzle(canvas, (n: number) => {
                $('#status').text(n > 5 ? n + ' Shuffling ' + '..........'.slice(n % 10) : '');
            });
            var reset = () => {
                var imgDir = ((no: string) => 'img/' + (
                    (no === '3') ? 'fukuchan03' :
                    (no === '2') ? 'fukuchan02' : 'fukuchan01'
                ) + '/')($('#selectedImage').val());
                var imgSrc = ((shortSide: number) => imgDir + (
                    (shortSide >= 1200) ? '1200.jpg' :
                    (shortSide >= 800) ? '800.jpg' :
                    (shortSide >= 600) ? '600.jpg' : '480.jpg'
                ))(window.innerWidth > window.innerHeight ? window.innerHeight : window.innerWidth);
                puzzle.initGame(imgSrc, $('#puzzleSize').val());
            };
            $('#btnReset').on('click', () => {
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
    onDeviceReady: function () { },

    // Update DOM on a Received Event
    receivedEvent: function () { }
};