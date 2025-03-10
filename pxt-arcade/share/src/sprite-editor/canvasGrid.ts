import { CanvasState } from './canvasState'
import { Edit } from './tools'
import * as utils from './util'

const alphaCellWidth = 5;
const dropdownPaddding = 4;
const lightModeBackground = "#dedede";

export class CanvasGrid {
    protected cellWidth: number = 16;
    protected cellHeight: number = 16;

    private gesture: GestureState;
    private context: CanvasRenderingContext2D;
    private fadeAnimation: Fade;
    private selectAnimation: number;

    protected backgroundLayer: HTMLCanvasElement;
    protected paintLayer: HTMLCanvasElement;
    protected overlayLayer: HTMLCanvasElement;

    mouseCol: number;
    mouseRow: number;

    scale: number;

    constructor(protected palette: string[], public state: CanvasState, protected lightMode = false, scale: number) {
        this.scale = scale;
        this.paintLayer = document.createElement("canvas");
        this.paintLayer.setAttribute("class", "sprite-editor-canvas");
        this.overlayLayer = document.createElement("canvas")
        this.overlayLayer.setAttribute("class", "sprite-editor-canvas")

        if (!this.lightMode) {
            this.backgroundLayer = document.createElement("canvas");
            this.backgroundLayer.setAttribute("class", "sprite-editor-canvas")
            this.context = this.paintLayer.getContext("2d");
        }
        else {
            this.context = this.paintLayer.getContext("2d", { alpha: false });
            this.context.fillStyle = lightModeBackground;
            this.context.fill();
        }

        this.hideOverlay();
    }


    get image() {
        return this.state.image;
    }

    setEyedropperMouse(on: boolean) {
        /* TODO
        const eyedropperClass = "sprite-editor-eyedropper";

        const toApply = on ? utils.addClass : utils.removeClass;
        toApply(this.paintLayer, eyedropperClass);
        toApply(this.overlayLayer, eyedropperClass);
        if (!this.lightMode) {
            toApply(this.backgroundLayer, eyedropperClass);
        }
        */
    }

    repaint(): void {
        this.clearContext(this.context);
        this.drawImage();
        if (this.state.floatingLayer) this.drawFloatingLayer();
        else this.hideOverlay();
    }

    applyEdit(edit: Edit, cursorCol: number, cursorRow: number, gestureEnd = false) {
        edit.doEdit(this.state);
        this.drawCursor(edit, cursorCol, cursorRow);
    }

    drawCursor(edit: Edit, col: number, row: number) {
        const cursor = edit.getCursor();

        if (cursor) {
            this.repaint();
            if (edit.showPreview) {
                edit.drawCursor(col, row, (c, r) => {
                    this.drawColor(c, r, edit.color);
                });
            }
            this.context.strokeStyle = "#898989";
            this.context.strokeRect((col + cursor.offsetX) * this.cellWidth, (row + cursor.offsetY) * this.cellHeight, cursor.width * this.cellWidth, cursor.height * this.cellHeight);
        }
        else if (edit.isStarted) {
            this.repaint();
        }
    }

    bitmap() {
        return this.image;
    }

    outerWidth(): number {
        return this.paintLayer.getBoundingClientRect().width;
    }

    outerHeight(): number {
        return this.paintLayer.getBoundingClientRect().height;
    }

    writeColor(col: number, row: number, color: number) {
        this.image.set(col, row, color);
        this.drawColor(col, row, color);
    }

    drawColor(col: number, row: number, color: number, context = this.context, transparency = !this.lightMode) {
        const x = col * this.cellWidth;
        const y = row * this.cellHeight;

        if (color) {
            context.fillStyle = this.palette[color - 1];
            context.fillRect(x, y, this.cellWidth, this.cellHeight);
        }
        else if (!transparency) {
            context.fillStyle = lightModeBackground;
            context.fillRect(x, y, this.cellWidth, this.cellHeight);
        }
    }

    restore(state: CanvasState, repaint = false) {
        if (state.height != this.image.height || state.width != this.image.width) {
            this.state = state.copy();
            this.resizeGrid(state.width, state.width * state.height);
        }
        else {
            this.state = state.copy();
        }

        if (repaint) {
            this.repaint();
        }
    }

    showResizeOverlay(): void {
        if (this.lightMode) return;

        if (this.fadeAnimation) {
            this.fadeAnimation.kill();
        }
        this.showOverlay();
        this.stopSelectAnimation();

        const w = this.overlayLayer.width;
        const h = this.overlayLayer.height;
        const context = this.overlayLayer.getContext("2d");
        const toastWidth = 100;
        const toastHeight = 40;
        const toastLeft = w / 2 - toastWidth / 2;
        const toastTop = h / 2 - toastWidth / 4;

        this.fadeAnimation = new Fade((opacity, dead) => {
            if (dead) {
                this.drawFloatingLayer();
                return;
            }

            this.clearContext(context);
            context.globalAlpha = opacity;
            context.fillStyle = "#898989";

            // After 32x32 the grid isn't easy to see anymore so skip it
            if (this.image.width <= 32 && this.image.height <= 32) {
                for (let c = 1; c < this.image.width; c++) {
                    context.fillRect(c * this.cellWidth, 0, 1, h);
                }
                for (let r = 1; r < this.image.height; r++) {
                    context.fillRect(0, r * this.cellHeight, w, 1);
                }
            }

            context.fillRect(toastLeft, toastTop, toastWidth, toastHeight);
            context.fillStyle = "#ffffff";
            context.font = "30px sans-serif";
            context.textBaseline = "middle";
            context.textAlign = "center";

            context.fillText(this.image.width.toString(), toastLeft + toastWidth / 2 - 25, toastTop + toastHeight / 2);
            context.fillText("x", toastLeft + 50, toastTop + toastHeight / 2, 10);
            context.fillText(this.image.height.toString(), toastLeft + toastWidth / 2 + 25, toastTop + toastHeight / 2);
        }, 750, 500);
    }

    showOverlay() {
        this.overlayLayer.style.visibility = "visible";
    }

    hideOverlay() {
        this.stopSelectAnimation();

        this.overlayLayer.style.visibility = "hidden";

        if (this.fadeAnimation) {
            this.fadeAnimation.kill();
        }
    }

    resizeGrid(rowLength: number, numCells: number): void {
        this.repaint();
    }

    setCellDimensions(width: number, height: number): void {
        this.cellWidth = width | 0;
        this.cellHeight = height | 0;

        const canvasWidth = this.cellWidth * this.image.width // * this.scale;
        const canvasHeight = this.cellHeight * this.image.height // * this.scale;

        this.paintLayer.width = canvasWidth;
        this.paintLayer.height = canvasHeight;
        this.overlayLayer.width = canvasWidth;
        this.overlayLayer.height = canvasHeight;

        if (!this.lightMode) {
            this.backgroundLayer.width = canvasWidth;
            this.backgroundLayer.height = canvasHeight;
        }
    }

    setGridDimensions(width: number, height = width, lockAspectRatio = true): void {
        const maxCellWidth = width / this.image.width;
        const maxCellHeight = height / this.image.height;

        if (lockAspectRatio) {
            const aspectRatio = this.cellWidth / this.cellHeight;

            if (aspectRatio >= 1) {
                const w = Math.min(maxCellWidth, maxCellHeight * aspectRatio);
                this.setCellDimensions(w, w * aspectRatio);
            }
            else {
                const h = Math.min(maxCellHeight, maxCellWidth / aspectRatio)
                this.setCellDimensions(h / aspectRatio, h);
            }
        }
        else {
            this.setCellDimensions(maxCellWidth, maxCellHeight);
        }
    }

    down(handler: (col: number, row: number) => void): void {
        this.initDragSurface();
        this.gesture.subscribe(GestureType.Down, handler);
    }

    up(handler: (col: number, row: number) => void): void {
        this.initDragSurface();
        this.gesture.subscribe(GestureType.Up, handler);
    }

    drag(handler: (col: number, row: number) => void): void {
        this.initDragSurface();
        this.gesture.subscribe(GestureType.Drag, handler);
    }

    move(handler: (col: number, row: number) => void): void {
        this.initDragSurface();
        this.gesture.subscribe(GestureType.Move, handler);
    }

    leave(handler: () => void): void {
        this.initDragSurface();
        this.gesture.subscribe(GestureType.Leave, handler);
    }

    updateBounds(top: number, left: number, width: number, height: number) {
        this.layoutCanvas(this.paintLayer, top, left, width, height);
        this.layoutCanvas(this.overlayLayer, top, left, width, height);

        if (!this.lightMode) {
            this.layoutCanvas(this.backgroundLayer, top, left, width, height);
        }

        this.drawImage();
        this.drawBackground();
    }

    render(parent: HTMLDivElement) {
        if (!this.lightMode) {
            parent.appendChild(this.backgroundLayer);
        }

        parent.appendChild(this.paintLayer);
        parent.appendChild(this.overlayLayer);
    }

    removeMouseListeners() {
        this.stopSelectAnimation();
        if (this.fadeAnimation) this.fadeAnimation.kill();

        this.endDrag();
    }

    onEditStart(col: number, row: number, edit: Edit) {
        edit.start(col, row, this.state);
    }

    onEditEnd(col: number, row: number, edit: Edit) {
        edit.end(col, row, this.state);
        this.drawFloatingLayer();
    }

    protected drawImage(image = this.image, context = this.context, left = 0, top = 0, transparency = !this.lightMode) {
        for (let c = 0; c < image.width; c++) {
            for (let r = 0; r < image.height; r++) {
                this.drawColor(left + c, top + r, image.get(c, r), context, transparency);
            }
        }
    }

    protected drawBackground() {
        if (this.lightMode) return;
        const context = this.backgroundLayer.getContext("2d", { alpha: false });
        const alphaCols = Math.ceil(this.paintLayer.width / alphaCellWidth);
        const alphaRows = Math.ceil(this.paintLayer.height / alphaCellWidth);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, this.paintLayer.width, this.paintLayer.height);

        context.fillStyle = "#dedede";
        for (let ac = 0; ac < alphaCols; ac++) {
            for (let ar = 0; ar < alphaRows; ar++) {
                if ((ac + ar) % 2) {
                    context.fillRect(ac * alphaCellWidth, ar * alphaCellWidth, alphaCellWidth, alphaCellWidth);
                }
            }
        }
    }

    /**
     * This calls getBoundingClientRect() so don't call it in a loop!
     */
    protected clientEventToCell(ev: MouseEvent) {
        const coord = clientCoord(ev);
        const bounds = this.paintLayer.getBoundingClientRect();
        const left = bounds.left + (window.scrollX !== null ? window.scrollX : window.pageXOffset);
        const top = bounds.top + (window.scrollY !== null ? window.scrollY : window.pageYOffset);

        let cellW = bounds.width / this.image.width
        let cellH = bounds.width / this.image.width

        this.mouseCol = Math.floor((coord.clientX - left) / cellW);
        this.mouseRow = Math.floor((coord.clientY - top) / cellH);

        return [
            this.mouseCol,
            this.mouseRow
        ];
    }
    protected drawFloatingLayer() {
        if (!this.state.floatingLayer) {
            return;
        }
        this.drawImage(this.state.floatingLayer, this.context, this.state.layerOffsetX, this.state.layerOffsetY, true);

        this.drawSelectionAnimation();
    }

    protected drawSelectionAnimation(dashOffset = 0) {
        if (!this.state.floatingLayer) {
            this.hideOverlay();
            return;
        }
        this.showOverlay();
        const context = this.overlayLayer.getContext("2d");
        this.clearContext(context);
        context.globalAlpha = 1;
        context.strokeStyle = "#303030";
        context.lineWidth = 2;
        context.setLineDash([5, 3]);
        context.lineDashOffset = dashOffset;
        context.strokeRect(this.state.layerOffsetX * this.cellWidth, this.state.layerOffsetY * this.cellHeight, this.state.floatingLayer.width * this.cellWidth, this.state.floatingLayer.height * this.cellHeight);


        if (!this.lightMode && !this.selectAnimation && (!this.fadeAnimation || this.fadeAnimation.dead)) {
            let drawLayer = () => {
                dashOffset++
                requestAnimationFrame(() => this.drawSelectionAnimation(dashOffset));
            };

            this.selectAnimation = window.setInterval(drawLayer, 40)
        }
    }

    private clearContext(context: CanvasRenderingContext2D) {
        // Paint Layer has the same dimensions as all other contexts
        context.clearRect(0, 0, this.paintLayer.width, this.paintLayer.height);
    }

    private initDragSurface() {

        if (!this.gesture) {
            this.gesture = new GestureState();

            this.bindEvents(this.paintLayer);
            this.bindEvents(this.overlayLayer);

            document.addEventListener(utils.pointerEvents.move, <EventListener>this.hoverHandler);
        }

    }

    private bindEvents(surface: HTMLElement) {
        utils.pointerEvents.down.forEach(evId => {
            surface.addEventListener(evId, <EventListener>((ev: MouseEvent) => {
                this.startDrag();
                const [col, row] = this.clientEventToCell(ev);
                this.gesture.handle(InputEvent.Down, col, row);
            }));
        })


        // surface.addEventListener("click", (ev: MouseEvent) => {
        //     const [col, row] = this.clientEventToCell(ev);
        //     this.gesture.handle(InputEvent.Down, col, row);
        //     this.gesture.handle(InputEvent.Up, col, row);
        // });
    }

    private upHandler = (ev: MouseEvent) => {
        this.endDrag();
        const [col, row] = this.clientEventToCell(ev);
        this.gesture.handle(InputEvent.Up, col, row);

        ev.stopPropagation();
        ev.preventDefault();
    }

    private leaveHandler = (ev: MouseEvent) => {
        this.endDrag();
        const [col, row] = this.clientEventToCell(ev);
        this.gesture.handle(InputEvent.Leave, col, row);

        ev.stopPropagation();
        ev.preventDefault();
    };

    private moveHandler = (ev: MouseEvent) => {
        const [col, row] = this.clientEventToCell(ev);
        if (col >= 0 && row >= 0 && col < this.image.width && row < this.image.height) {
            if (ev.buttons & 1) {
                this.gesture.handle(InputEvent.Down, col, row);
            }
            this.gesture.handle(InputEvent.Move, col, row);
        }

        ev.stopPropagation();
        ev.preventDefault();
    }

    private hoverHandler = (ev: MouseEvent) => {
        const [col, row] = this.clientEventToCell(ev);
        if (col >= 0 && row >= 0 && col < this.image.width && row < this.image.height) {
            this.gesture.handle(InputEvent.Move, col, row);
            this.gesture.isHover = true;
        }
        else if (this.gesture.isHover) {
            this.gesture.isHover = false;
            this.gesture.handle(InputEvent.Leave, -1, -1);
        }
    }

    private startDrag() {
        document.removeEventListener(utils.pointerEvents.move, <EventListener>this.hoverHandler);
        document.addEventListener(utils.pointerEvents.move, <EventListener>this.moveHandler);
        document.addEventListener(utils.pointerEvents.up, <EventListener>this.upHandler);

        if (utils.isTouchEnabled() && !utils.hasPointerEvents()) {
            document.addEventListener("touchend", <EventListener>this.upHandler);
            document.addEventListener("touchcancel", <EventListener>this.leaveHandler);
        }
        else {
            document.addEventListener(utils.pointerEvents.leave, <EventListener>this.leaveHandler);
        }

    }

    private endDrag() {

        document.addEventListener(utils.pointerEvents.move, <EventListener>this.hoverHandler);
        document.removeEventListener(utils.pointerEvents.move, <EventListener>this.moveHandler);
        document.removeEventListener(utils.pointerEvents.up, <EventListener>this.upHandler);
        document.removeEventListener(utils.pointerEvents.leave, <EventListener>this.leaveHandler);

        if (utils.isTouchEnabled() && !utils.hasPointerEvents()) {
            document.removeEventListener("touchend", <EventListener>this.upHandler);
            document.removeEventListener("touchcancel", <EventListener>this.leaveHandler);
        }
        else {
            document.removeEventListener(utils.pointerEvents.leave, <EventListener>this.leaveHandler);
        }

    }

    private layoutCanvas(canvas: HTMLCanvasElement, top: number, left: number, width: number, height: number) {
        // canvas.style.position = "absolute";
        // canvas.style.top = `0px`
        // canvas.style.left = `0px`

        // if (this.image.width === this.image.height) {
        //     canvas.style.top = top + "px";
        //     canvas.style.left = left + "px";
        // }
        // else if (this.image.width > this.image.height) {
        //     canvas.style.top = (top + dropdownPaddding + (height - canvas.height) / 2) + "px";
        //     canvas.style.left = left + "px";
        // }
        // else {
        //     canvas.style.top = top + "px";
        //     canvas.style.left = (left + dropdownPaddding + (width - canvas.width) / 2) + "px";
        // }
    }

    private stopSelectAnimation() {
        if (this.selectAnimation) {
            clearInterval(this.selectAnimation);
            this.selectAnimation = undefined;
        }

    }
}

enum InputEvent {
    Up,
    Down,
    Move,
    Leave
}

enum GestureType {
    Up,
    Down,
    Move,
    Drag,
    Leave
}

type GestureHandler = (col: number, row: number) => void;

class GestureState {
    lastCol: number;
    lastRow: number;

    isDown = false;
    isHover = false;

    handlers: { [index: number]: GestureHandler } = {};

    handle(event: InputEvent, col: number, row: number) {
        switch (event) {
            case InputEvent.Up:
                this.update(col, row);
                this.isDown = false;
                this.fire(GestureType.Up);
                break;
            case InputEvent.Down:
                if (!this.isDown) {
                    this.update(col, row);
                    this.isDown = true;
                    this.fire(GestureType.Down);
                }
                break;
            case InputEvent.Move:
                if (col === this.lastCol && row === this.lastRow) return;
                this.update(col, row);
                if (this.isDown) {
                    this.fire(GestureType.Drag);
                }
                else {
                    this.fire(GestureType.Move);
                }
                break;

            case InputEvent.Leave:
                this.update(col, row);
                this.isDown = false;
                this.fire(GestureType.Leave);
                break;
        }
    }

    subscribe(type: GestureType, handler: GestureHandler) {
        this.handlers[type] = handler;
    }

    protected update(col: number, row: number) {
        this.lastCol = col;
        this.lastRow = row;
    }

    protected fire(type: GestureType) {
        if (this.handlers[type]) {
            this.handlers[type](this.lastCol, this.lastRow);
        }
    }
}

class Fade {
    start: number;
    end: number;
    slope: number;
    dead: boolean;

    constructor(protected draw: (opacity: number, dead: boolean) => void, delay: number, duration: number) {
        this.start = Date.now() + delay;
        this.end = this.start + duration;
        this.slope = 1 / duration;
        this.dead = false;

        draw(1, false);

        setTimeout(() => requestAnimationFrame(() => this.frame()), delay);
    }

    frame() {
        if (this.dead) return;
        const now = Date.now();
        if (now < this.end) {
            const v = 1 - (this.slope * (now - this.start));
            this.draw(v, false);
            requestAnimationFrame(() => this.frame());
        }
        else {
            this.kill();
            this.draw(0, true);
        }
    }

    kill() {
        this.dead = true;
    }
}

export interface ClientCoordinates {
    clientX: number;
    clientY: number;
}

function clientCoord(ev: PointerEvent | MouseEvent | TouchEvent): ClientCoordinates {
    if ((ev as TouchEvent).touches) {
        const te = ev as TouchEvent;
        if (te.touches.length) {
            return te.touches[0];
        }
        return te.changedTouches[0];
    }
    return (ev as PointerEvent | MouseEvent);
}