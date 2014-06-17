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
class Block {
    constructor(private _position: number, public imgPosition: number, public isBlank = false) { }
    public get position() { return this._position; }
    public get label() { return String(this.imgPosition + 1); }
    public get isCorrect() { return this.imgPosition === this.position; }
}

class FifteenPuzzle {
    private image: HTMLImageElement;
    private ctx: CanvasRenderingContext2D;
    private rowCount: number;
    private colCount: number;
    private numBlocks: number;
    private showNumber: boolean;
    private moveCount: number;
    private initMoment: Moment;
    private blockWidth: number;
    private blockHeight: number;
    private blocks: Block[] = [];
    private blankBgColor: string;
    private isLocked = false;
    private UDLR = [
        [0, -1], // Up
        [0,  1], // Down
        [-1, 0], // Left
        [1,  0]  // Right
    ];

    constructor(private canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d');
        var colors = ['Blue', 'Green', 'Red', 'DeepSkyBlue', 'SeaGreen', 'Pink', 'Silver', 'FireBrick', 'Linen'];
        this.blankBgColor = colors[this.rnd(colors.length)];
        canvas.onmousedown = this.getMouseHandlerFunction();
        moment.lang('ja');
    }

    // 15パズルを開始します。
    public initGame(imgSrc: string, rowCount = 4, showNumber = true) {
        if (this.isLocked) { return; }
        this.showNumber = showNumber;
        this.rowCount = this.colCount = rowCount;
        this.numBlocks = this.rowCount * this.colCount;
        this.moveCount = 0;
        this.initMoment = moment();
        this.image = new Image();
        this.image.src = imgSrc;
        this.image.onload = () => {
            this.blockWidth = this.image.width / this.colCount;
            this.blockHeight = this.image.height / this.rowCount;
            this.canvas.width = this.image.width;
            this.canvas.height = this.image.height;
            this.ctx.drawImage(this.image, 10, 10, this.image.width, this.image.height);
            this.isLocked = true;
            // パズルのブロックを作成
            for (var i = 0; i < this.numBlocks; i++) {
                // 末尾(右下)を空きブロックとする
                var isBlank = (i === this.numBlocks - 1);
                this.blocks[i] = new Block(i, i, isBlank);
            }

            // 画像を表示する
            this.drawPazzle(this.blocks);
            // 1秒後にシャッフルを開始する
            setTimeout(() => {
                this.shufflePazzle(50 * this.rowCount, () => { this.isLocked = false; /*ゲーム開始*/ });
            }, 1000);
        }
    }

    // パズルを描画します。
    private drawPazzle(targetBlocks: Block[], showNumber = this.showNumber, drawStroke = true) {
        targetBlocks.forEach((block) => {
            var desPoint = this.getCoordinates(block.position);    // 描画先座標を計算
            var srcPoint = this.getCoordinates(block.imgPosition); // 描画元座標を計算

            if (block.isBlank) {
                this.ctx.fillStyle = this.blankBgColor;
                this.ctx.fillRect(desPoint.x, desPoint.y, this.blockWidth, this.blockHeight);
            } else {
                this.ctx.drawImage(
                    this.image,
                    srcPoint.x, srcPoint.y, this.blockWidth, this.blockHeight,
                    desPoint.x, desPoint.y, this.blockWidth, this.blockHeight
                );
            }

            if (showNumber && !block.isBlank) {
                // ブロック番号を描画する
                var fontSize = this.blockWidth / 3;
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold ' + String(fontSize) + 'px Arial';
                this.ctx.fillText(block.label,
                    desPoint.x + (this.blockWidth - fontSize) / 2,
                    desPoint.y + (this.blockHeight + fontSize / 2) / 2
                );
            }

            // 画像の枠を描画
            if (drawStroke) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 1.5;
                this.ctx.rect(desPoint.x, desPoint.y, this.blockWidth, this.blockHeight);
                this.ctx.stroke();
                this.ctx.closePath();
            }
        });
    }

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
                    this.move(sourceBlock);
                    this.moveCount += 1;
                    this.checkClear();
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
    private shufflePazzle(count: number, callback?: () => void) {
        var suffle = () => {
            if (count < 0) { count = 1; }
            if (count -= 1) {
                this.move(this.getRandomMovableBlock());
                setTimeout(suffle, 25);
            } else { callback(); }
        };
        suffle();
    }

    /// クリアしたかどうかをチェックします。
    private checkClear() {
        var isCleared = this.blocks.every(block => block.isCorrect || block.isBlank);
        if (isCleared) {
            var m = moment();
            var min = m.diff(this.initMoment, 'minutes');
            var sec = m.diff(this.initMoment, 'seconds');
            alert(
                '完成！\n\n' +
                'かかった手数: ' + this.moveCount + '手\n' +
                'かかった時間: ' + min + '分' + ('0' + (sec - min * 60)).slice(-2) + '秒'
            );
            this.getBlankBlock().isBlank = false;
            this.drawPazzle(this.blocks, false, false);
        }
    }

    // 指定したブロックNoのブロックを動かします。
    private move(sourceBlock: Block) {
        var blankBlock = this.getBlankBlock();
        var sourceImgPosition = sourceBlock.imgPosition;
        sourceBlock.imgPosition = blankBlock.imgPosition;
        sourceBlock.isBlank = true;
        blankBlock.imgPosition = sourceImgPosition
        blankBlock.isBlank = false;
        this.drawPazzle([sourceBlock, blankBlock]);
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

var app = {
    // Application Constructor
    initialize: function () {
        this.bindEvents();
        $(() => {
            var canvas = <HTMLCanvasElement>document.getElementById('canvas');
            var puzzle = new FifteenPuzzle(canvas);
            var reset = () => { 
                var imgDir = ((no: string) => 'img/' + (
                    (no === '3') ? 'fukuchan03' :
                    (no === '2') ? 'fukuchan02' : 'fukuchan01'
                ) + '/')($('#selectedImage').val());
                var imgSrc = ((w: number) => imgDir + (
                    (w >= 1200) ? '1200.jpg' :
                    (w >= 800) ? '800.jpg' :
                    (w >= 600) ? '600.jpg' : '480.jpg'
                ))(window.innerWidth);
                puzzle.initGame(imgSrc, $('#puzzleSize').val());
            };
            $('#btnReset').on('click', () => {
                reset();
            }).trigger('click');
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
        app.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function () {
    }
};