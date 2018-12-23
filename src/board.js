/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * Go board-related stuff
 */

/**
 * @class Keeps track of board state and passes off rendering to a renderer.
 * We can theoretically have any kind of renderer. The board state is
 * independent of its visual presentation.
 */

export class Board {
    /**
     * @constructor
     * @param {Object} The renderer to use to draw the board. Renderers must
     * have at least three methods: clear(), renderStone(), and renderMarker()
     * @param {Number} Board size -- theoretically could be any size,
     * but there's currently only CSS for 9, 13, and 19
     */
    constructor(renderer, boardSize) {
        this.boardSize  = boardSize || 19;
        this.renderer   = renderer;
        this.init();
    }

    init() {
        this.WHITE = 1;
        this.BLACK = -1;
        this.EMPTY = 0;
        this.stones     = this.makeBoardArray(this.EMPTY);
        this.markers    = this.makeBoardArray(this.EMPTY);
        this.captures   = {};
        this.captures.W = 0;
        this.captures.B = 0;
        this.cache      = [];
    }

    /**
     * Creates a unique string from the current board position.
     * Mostly for Ko-Detection. See also rules.js.
    **/
    get_serialized_state_str() {
        let stones = this.stones;
        let out = "";
        for (var x = 0; x < this.boardSize; x++) {
            for (var y = 0; y < this.boardSize; y++) {
                let offset = y * this.boardSize + x;
                if (!(stones[offset] && stones[offset] != this.EMPTY))
                    continue;

                let s = stones[offset] == this.WHITE
                        ? -offset
                        : offset;
                if (out != "") out += ",";
                out += "" + s;
            }
        }
        return out;
    }

    reset() {
        console.log("{board} reset");
        this.init(this.renderer, this.boardSize);
    }

    clear() {
        console.log("{board} clear");
        this.clearStones();
        this.clearMarkers();
        this.clearCaptures();
    }

    clearStones() {
        console.log("{board} clearStones");
        // we could use makeBoardArray(), but this is more efficient
        for (var i = 0; i < this.stones.length; i++) {
            this.stones[i] = this.EMPTY;
        }
    }

    clearMarkers() {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i] = this.EMPTY;
        }
    }

    clearCaptures() {
        this.captures.W = 0;
        this.captures.B = 0;
    }

    makeBoardArray(val) {
        // We could use a multi-dimensional array but doing this avoids
        // the need for deep copying during commit, which is very slow.
        let ar = [];
        ar.fill(this.boardSize * this.boardSize, val);
        return ar;
    }

    /**
     * Save the current state. This allows us to revert back
     * to previous states for, say, navigating backwards in a game.
     */
    commit() {
        console.log("{board} commit");
        this.cache.push({
            stones:     this.stones.concat(),
            serialized: this.get_serialized_state_str(),
            captures:   { W: this.captures.W, B: this.captures.B }
        });
    }

    /**
     * Checks whether this board has seen the serialized state ser_state
     * (calculated by get_serialized_state_str() before).
     * Used for Ko-detection.
    **/
    check_state_already_exists(ser_state) {
        for (let i = 0; i < this.cache.length; i++) {
            //d// console.log("CHECK STATE (" + i + ")");
            //d// console.log(this.cache[i].serialized)
            //d// console.log(ser_state);
            if (this.cache[i].serialized == ser_state) {
                return true;
            }
        }
        return false;
    }

    /**
     * Undo any uncomitted changes.
     */
    rollback() {
        let last =
            this.cache.length > 0
            ? this.cache[this.cache.length - 1]
            : null;

        console.log("{board} rollback")//, last);

        if (last) {
            this.stones     = last.stones.concat();
            this.captures.W = last.captures.W;
            this.captures.B = last.captures.B;
        } else {
            this.clear();
        }
    }

    /**
     * Revert to a previous state.
     */
    revert(steps) {
        console.log("{board} revert", steps);

        steps = steps || 1;
        this.rollback();
        for (var i = 0; i < steps; i++) {
            this.cache.pop();
        }
        this.rollback();
    }

    addStone(pt, color) {
        console.log("{board} addStone"); // , [pt.x, pt.y, color]);
        this.stones[pt.y * this.boardSize + pt.x] = color;
    }

    getStone(pt) {
        let stone = this.stones[pt.y * this.boardSize + pt.x];
        if (stone == null) return this.EMPTY;
        else return stone;
    }

    isOccupied(pt) {
        return !(this.getStone(pt) == this.EMPTY);
    }

    isFree(pt) {
        return (this.getStone(pt) == this.EMPTY);
    }

    getRegion(t, l, w, h) {
        var region = [];
        region.fill(w * h, this.EMPTY);
        for (var y = t; y < t + h; y++) {
            for (var x = l; x < l + w; x++) {
                let offset = (y - t) * w + (x - l);
                region[offset] = this.getStone({x:x, y:y});
            }
        }
        return region;
    }

    addMarker(pt, type, pt2) {
        this.markers[pt.y * this.boardSize + pt.x] = [type, pt2];
    }

    getMarker(pt) {
        return this.markers[pt.y * this.boardSize + pt.x];
    }

    get_stone_pt_list() {
        let stone_pt_list = [];
        let stones = this.stones;
        for (var x = 0; x < this.boardSize; x++) {
            for (var y = 0; y < this.boardSize; y++) {
                let offset = y * this.boardSize + x;
                let color = stones[offset];
                if (color == this.WHITE || color == this.BLACK)
                    stone_pt_list.push([color, x + 1, y + 1])
            }
        }
        return stone_pt_list;
    }

    render() {
        var type;
        var len;
        let stones = this.stones;
        let markers = this.markers;
        this.renderer.start_redraw();
        for (var x = 0; x < this.boardSize; x++) {
            for (var y = 0; y < this.boardSize; y++) {
                let offset = y * this.boardSize + x;
                let color = (stones[offset] == this.WHITE
                             ? "white"
                             : (stones[offset] == this.BLACK
                                ? "black"
                                : null));
                if (   markers[offset] != null
                    && markers[offset] != this.EMPTY) {
                    if (markers[offset] instanceof Array) {
                        this.renderer.draw_marker(
                            x, y, markers[offset][0], color, markers[offset][1]);
                    } else {
                        this.renderer.draw_marker(
                            x, y, markers[offset], color);
                    }
                }
                if (color)
                    this.renderer.draw_stone(x, y, color);
            }
        }
        this.renderer.finish_redraw();
    }
};

///**
// * @class An HTML/DOM-based board renderer.
// */
//eidogo.BoardRendererHtml = function() {
//    this.init.apply(this, arguments);
//}
//eidogo.BoardRendererHtml.prototype = {
//    /**
//     * @constructor
//     * @param {HTMLElement} domContainer Where to put the board
//     */
//    init(domContainer, boardSize, player, crop) {
//        if (!domContainer) {
//            throw "No DOM container";
//            return;
//        }
//        this.boardSize = boardSize || 19;
//        var domGutter = document.createElement('div');
//        domGutter.className = "board-gutter" + (this.boardSize == 19 ?
//                " with-coords" : "");
//        domContainer.appendChild(domGutter);
//        var domBoard = document.createElement('div');
//        domBoard.className = "board size" + this.boardSize;
//        domBoard.style.position = (crop && eidogo.browser.ie ? "static" : "relative");
//        domGutter.appendChild(domBoard);
//        this.domNode = domBoard;
//        this.domGutter = domGutter;
//        this.domContainer = domContainer;
//        this.player = player;
//        this.uniq = domContainer.id + "-";
//        this.renderCache = {
//            stones: [].setLength(this.boardSize, 0).addDimension(this.boardSize, 0),
//            markers: [].setLength(this.boardSize, 0).addDimension(this.boardSize, 0)
//        }
//        // auto-detect point width, point height, and margin
//        this.pointWidth = 0;
//        this.pointHeight = 0;
//        this.margin = 0;
//        var stone = this.renderStone({x:0,y:0}, "black");
//        this.pointWidth = this.pointHeight = stone.offsetWidth;
//        this.renderStone({x:0,y:0}, "white"); // just for image caching
//        this.renderMarker({x:0,y:0}, "current"); // just for image caching
//        this.clear();
//        this.margin = (this.domNode.offsetWidth - (this.boardSize * this.pointWidth)) / 2;
//        
//        // needed to accommodate IE's broken layout engine
//        this.scrollX = 0;
//        this.scrollY = 0;
//        
//        if (crop) {
//            this.crop(crop);
//            if (eidogo.browser.ie) {
//                var parent = this.domNode.parentNode;
//                while (parent && parent.tagName && !/^body|html$/i.test(parent.tagName)) {
//                    this.scrollX += parent.scrollLeft;
//                    this.scrollY += parent.scrollTop;
//                    parent = parent.parentNode;
//                }
//            }
//        }
//        
//        // add the search region selection box for later use
//        this.dom = {};
//        this.dom.searchRegion = document.createElement('div');
//        this.dom.searchRegion.id = this.uniq + "search-region";
//        this.dom.searchRegion.className = "search-region";
//        this.domNode.appendChild(this.dom.searchRegion);
//        
//        eidogo.util.addEvent(this.domNode, "mousemove", this.handleHover, this, true);
//        eidogo.util.addEvent(this.domNode, "mousedown", this.handleMouseDown, this, true);
//        eidogo.util.addEvent(this.domNode, "mouseup", this.handleMouseUp, this, true);
//    }
//    showRegion(bounds) {
//        this.dom.searchRegion.style.top = (this.margin + this.pointHeight * bounds[0]) + "px";
//        this.dom.searchRegion.style.left = (this.margin + this.pointWidth * bounds[1]) + "px";
//        this.dom.searchRegion.style.width = this.pointWidth * bounds[2] + "px";
//        this.dom.searchRegion.style.height = this.pointHeight * bounds[3] + "px";
//        eidogo.util.show(this.dom.searchRegion);
//    }
//    hideRegion() {
//        eidogo.util.hide(this.dom.searchRegion);  
//    }
//    clear() {
//        this.domNode.innerHTML = "";
//    }
//    renderStone(pt, color) {
//        var stone = document.getElementById(this.uniq + "stone-" + pt.x + "-" + pt.y);
//        if (stone) {
//            stone.parentNode.removeChild(stone);
//        }
//        if (color != "empty") {
//            var div = document.createElement("div");
//            div.id = this.uniq + "stone-" + pt.x + "-" + pt.y;
//            div.className = "point stone " + color;
//            try {
//                div.style.left = (pt.x * this.pointWidth + this.margin - this.scrollX) + "px";
//                div.style.top = (pt.y * this.pointHeight + this.margin - this.scrollY) + "px";
//            } catch (e) {}
//            this.domNode.appendChild(div);
//            return div;
//        }
//        return null;
//    }
//    renderMarker(pt, type) {
//        if (this.renderCache.markers[pt.x][pt.y]) {
//            var marker = document.getElementById(this.uniq + "marker-" + pt.x + "-" + pt.y);
//            if (marker) {
//                marker.parentNode.removeChild(marker);
//            }
//        }
//        if (type == "empty" || !type) { 
//            this.renderCache.markers[pt.x][pt.y] = 0;
//            return null;
//        }
//        this.renderCache.markers[pt.x][pt.y] = 1;
//        if (type) {
//            var text = "";
//            switch (type) {
//                case "triangle":
//                case "square":
//                case "circle":
//                case "ex":
//                case "territory-white":
//                case "territory-black":
//                case "dim":
//                case "current":
//                    break;
//                default:
//                    if (type.indexOf("var:") == 0) {
//                        text = type.substring(4);
//                        type = "variation";
//                    } else {
//                        text = type;
//                        type = "label";
//                    }
//                    break;
//            }
//            var div = document.createElement("div");
//            div.id = this.uniq + "marker-" + pt.x + "-" + pt.y;
//            div.className = "point marker " + type;
//            try {
//                div.style.left = (pt.x * this.pointWidth + this.margin - this.scrollX) + "px";
//                div.style.top = (pt.y * this.pointHeight + this.margin - this.scrollY) + "px";
//            } catch (e) {}
//            div.appendChild(document.createTextNode(text));
//            this.domNode.appendChild(div);
//            return div;
//        }
//        return null;
//    }
//    setCursor(cursor) {
//        this.domNode.style.cursor = cursor;
//    }
//    handleHover(e) {
//        var xy = this.getXY(e);
//        this.player.handleBoardHover(xy[0], xy[1], xy[2], xy[3], e);
//    }
//    handleMouseDown(e) {
//        var xy = this.getXY(e);
//        this.player.handleBoardMouseDown(xy[0], xy[1], xy[2], xy[3], e);
//    }
//    handleMouseUp(e) {
//        var xy = this.getXY(e);
//        this.player.handleBoardMouseUp(xy[0], xy[1]);
//    }
//    /**
//     *  Gets the board coordinates (0-18) for a mouse event
//    **/
//    getXY(e) {
//        var clickXY = eidogo.util.getElClickXY(e, this.domNode);
//        
//        var m = this.margin;
//        var pw = this.pointWidth;
//        var ph = this.pointHeight;
//        
//        var x = Math.round((clickXY[0] - m - (pw / 2)) / pw);
//        var y = Math.round((clickXY[1] - m - (ph / 2)) / ph);
//    
//        return [x, y, clickXY[0], clickXY[1]];
//    }
//    crop(crop) {
//        eidogo.util.addClass(this.domContainer, "shrunk");
//        this.domGutter.style.overflow = "hidden";
//        var width = crop.width * this.pointWidth + (this.margin * 2);
//        var height = crop.height * this.pointHeight + (this.margin * 2);
//        this.domGutter.style.width = width + "px";
//        this.domGutter.style.height = height + "px";
//        this.player.dom.player.style.width = width + "px";
//        this.domGutter.scrollLeft = crop.left * this.pointWidth;
//        this.domGutter.scrollTop = crop.top * this.pointHeight;
//    }
//}
//
///**
// * Flash board renderer
//**/
//eidogo.BoardRendererFlash = function() {
//    this.init.apply(this, arguments);
//}
//eidogo.BoardRendererFlash.prototype = {
//    /**
//     * @constructor
//     * @param {HTMLElement} domContainer Where to put the board
//     */
//    init(domContainer, boardSize, player, crop) {
//        if (!domContainer) {
//            throw "No DOM container";
//            return;
//        }
//        this.ready = false;
//        this.swf = null;
//        this.unrendered = [];
//        var swfId = domContainer.id + "-board";
//        var so = new SWFObject(eidogo.playerPath + "/swf/board.swf", swfId,
//            "421", "421", "8", "#665544");
//        so.addParam("allowScriptAccess", "sameDomain");
//        so.write(domContainer);
//        var elapsed = 0;
//        var initBoard = function() {
//            swf = eidogo.util.byId(swfId);
//            if (!swf || !swf.init) {
//                if (elapsed > 2000) {            
//                    throw "Error initializing board";
//                    return;
//                }
//                setTimeout(arguments.callee.bind(this), 10);
//                elapsed += 10;
//                return;
//            }
//            this.swf = swf;
//            this.swf.init(player.uniq, boardSize);
//            this.ready = true;
//        }.bind(this);
//        initBoard();
//    }
//    showRegion(bounds) {
//    }
//    hideRegion() {
//    }
//    clear() {
//        if (!this.swf) return;
//        this.swf.clear();
//    }
//    renderStone(pt, color) {
//        if (!this.swf) {
//            this.unrendered.push(['stone', pt, color]);
//            return;
//        }
//        for (var i = 0; i < this.unrendered.length; i++) {
//            if (this.unrendered[i][0] == "stone") {
//                this.swf.renderStone(this.unrendered[i][1], this.unrendered[i][2]);
//            }
//        }
//        this.unrendered = [];
//        this.swf.renderStone(pt, color);
//    }
//    renderMarker(pt, type) {
//        if (!type) return;
//        if (!this.swf) {
//            this.unrendered.push(['marker', pt, type]);
//            return;
//        }
//        for (var i = 0; i < this.unrendered.length; i++) {
//            if (this.unrendered[i][0] == "marker") {
//                this.swf.renderMarker(this.unrendered[i][1], this.unrendered[i][2]);
//            }
//        }
//        this.unrendered = [];
//        this.swf.renderMarker(pt, type);
//    }
//    setCursor(cursor) {
//    }
//    crop() {
//    }
//}

///**
// * @class ASCII board renderer! Kinda broken.
// */
//eidogo.BoardRendererAscii = function(domNode, boardSize) {
//    this.init(domNode, boardSize);
//}
//eidogo.BoardRendererAscii.prototype = {
//    pointWidth: 2,
//    pointHeight: 1,
//    margin: 1,
//    blankBoard: "+-------------------------------------+\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "|. . . . . . . . . . . . . . . . . . .|\n" +
//                "+-------------------------------------+",
//    init(domNode, boardSize) {
//        this.domNode = domNode || null;
//        this.boardSize = boardSize || 19;
//        this.content = this.blankBoard;
//    }
//    clear() {
//        this.content = this.blankBoard;
//        this.domNode.innerHTML = "<pre>" + this.content + "</pre>";
//    }
//    renderStone(pt, color) {
//        var offset = (this.pointWidth * this.boardSize + this.margin * 2)
//            * (pt.y * this.pointHeight + 1)
//            + (pt.x * this.pointWidth) + 2;
//        this.content = this.content.substring(0, offset-1) + "."
//            + this.content.substring(offset);
//        if (color != "empty") {
//            this.content = this.content.substring(0, offset-1) +
//                (color == "white" ? "O" : "#") + this.content.substring(offset);
//        }
//        this.domNode.innerHTML = "<pre>" + this.content + "</pre>";
//    }
//    renderMarker(pt, type) {
//        // I don't think this is possible
//    }
//}
