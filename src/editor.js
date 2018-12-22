/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Copyright (c) 2018, Weird Constructor <weirdconstructor@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * New Player code for adapted eidgo code.
 */

class GoEditor {
    constructor(renderer) {
        this.renderer = renderer;
        this.reset_label_counter();
        this.reset_current_color();

        this.timeB = "";
        this.timeW = "";

        // handlers for the various types of GameNode properties
        this.prop_handlers = {
            W:  this.ph_play_move,  // play white stone
            B:  this.ph_play_move,  // play black stone
            KO: this.ph_play_move,
            MN: this.ph_set_move_number,
            AW: this.ph_add_stone,  // add white stone
            AB: this.ph_add_stone,  // add black stone
            AE: this.ph_add_stone,  // add empty stone
            CR: this.ph_add_marker, // circle
            LB: this.ph_add_marker, // label
            TR: this.ph_add_marker, // triangle
            MA: this.ph_add_marker, // X
            SQ: this.ph_add_marker, // square
            TW: this.ph_add_marker, // territory W
            TB: this.ph_add_marker, // territory B
            LN: this.ph_add_marker, // line
            AR: this.ph_add_marker, // arrow
            DD: this.ph_add_marker, // dim
            PL: this.ph_set_color,  // set player color
            C:  this.ph_show_comments,
            N:  this.ph_show_annotation,
            GB: this.ph_show_annotation,
            GW: this.ph_show_annotation,
            DM: this.ph_show_annotation,
            HO: this.ph_show_annotation,
            UC: this.ph_show_annotation,
            V:  this.ph_show_annotation,
            BM: this.ph_show_annotation,
            DO: this.ph_show_annotation,
            IT: this.ph_show_annotation,
            TE: this.ph_show_annotation,
            BL: this.ph_show_time,
            OB: this.ph_show_time,
            WL: this.ph_show_time,
            OW: this.ph_show_time
        };
    }

    load_sgf(sgf_string) {
        let sgf_parser = new SgfParser(sgf_string);
        let node = new GameNode();
        node.load_json(sgf_parser.root);
        console.log("Game Count:", node._children.length);
        this.game_root = node._children[0]; // first game
        this.init_game(node._children[0]);
        this.refresh();
    }

    init_game(game_node) {
        this.game_root = game_node;
        this.size = game_node.SZ || 19;

        this.renderer.set_size(this.size);

        this.board = new Board(this.renderer, this.size);
        this.rules = new Rules(this.board);
        this.cursor = new GameCursor(this.game_root);
        this.reset_cursor(true);

        let p = this.cursor.get_max_move_count();
        console.log("PATH:", p);
        this.ph_set_move_number(0);
        this.find_variations();
    }

    reset_label_counter() {
        this.labelLastNumber = 1;
        this.labelLastLetter = "A";
    }

    /**
     * Navigates to a location within the game. Takes progressive loading
     * into account.
    **/
    go_to(path, fromStart) {
        fromStart = fromStart != null ? fromStart : true;

        if (fromStart)
            this.reset_cursor(true);

        // Move number
        var steps = parseInt(path, 10);
        if (!(path instanceof Array) && !isNaN(steps)) {
            if (fromStart) steps++; // not zero-based
            for (var i = 0; i < steps; i++)
                this.variation(null, true);
            this.refresh();
            return;
        }

        // Not a path?
        if (!(path instanceof Array) || !path.length) {
            console.log("ERROR: bad path:", path);
            return;
        }

        var position;
        var vars;

        // Path of moves (SGF coords)
        if (isNaN(parseInt(path[0], 10))) {
            if (!this.cursor.node._parent)
                this.variation(0, true); // first game tree is assumed

            while (path.length) {
                position = path.shift();
                vars = this.get_variations();
                for (var i = 0; i < vars.length; i++) {
                    if (vars[i].move == position) {
                        this.variation(vars[i].varNum, true);
                        break;
                    }
                }
            }

            this.refresh();
            return;
        }

        // Path of branch indexes and final move number
        var first = true;
        while (path.length) {
            position = parseInt(path.shift(), 10);
            if (!path.length) {
                for (var i = 0; i < position; i++)
                    this.variation(0, true);
            } else if (path.length) {
                if (!first && fromStart)
                    while (this.cursor.node._children.length == 1)
                        this.variation(0, true);
                this.variation(position, true);
            }
            first = false;
        }
        this.refresh();
    }

    back(no_render) {
        if (this.cursor.previous()) {
            this.board.revert(1);
            this.refresh(no_render);
            this.reset_label_counter();
            return true;
        }
        return false;
    }

    forward(e, obj, no_render) {
        this.variation(null, no_render);
    }

    first() {
        if (!this.cursor.hasPrevious()) return;
        this.reset_cursor(false, true);
    }

    last() {
        if (!this.cursor.hasNext()) return;
        while (this.variation(null, true)) {}
        this.refresh();
    }

    pass() {
        if (!this.variations) return;
        for (var i = 0; i < this.variations.length; i++) {
            if (!this.variations[i].move || this.variations[i].move == "tt") {
                this.variation(this.variations[i].varNum);
                return;
            }
        }
        this.create_move('tt');
    }

    /**
     * Create an as-yet unplayed move and go to it.
     */
    create_move(coord) {
        var props = {};
        props[this.currentColor] = coord;
        var varNode = new GameNode(null, props);
        let varNum = this.cursor.node.appendChild(varNode);
        this.variation(varNum);
    }

    /**
     * Handles going the next sibling or variation
     * @param {Number} var_num Variation number to follow
     * @param {Boolean} no_render If true, don't render the board
     */
    variation(var_num, no_render) {
        if (this.cursor.next(var_num)) {
            this.exec_node(no_render);
            // TODO: FIXME reset_label_counter should be removed, the next
            //             label num/alphnum should be calculated from
            //             the Board class anyways!
            this.reset_label_counter();
            return true;
        }
        return false;
    }

    ph_set_move_number(num) {
        this.moveNumber = num;
    }

    /**
     * Delegates the work of putting down stones etc to various handler
     * functions. Also resets some settings and makes sure the interface
     * gets updated.
     * @param {Boolean} no_render If true, don't render the board
     */
    exec_node(no_render) {
        if (!this.cursor.node) return;

        if (!no_render) {
            this.board.clearMarkers();
            this.moveNumber = this.cursor.getMoveNumber();
        }

        if (this.moveNumber < 1) {
            this.reset_current_color();
        }

        // execute handlers for the appropriate properties
        var props = this.cursor.node.getProperties();
        console.log("EXEC PROP:", props);
        for (var p_name in props) {
            if (this.prop_handlers[p_name]) {
                (this.prop_handlers[p_name]).apply(
                    this, [this.cursor.node[p_name], p_name, no_render]);
            }
        }

        // Create silbling markers:
        let silb = this.cursor.node.getSilblings();
        if (silb) {
            let cur_sgf_coord = this.cursor.node.getMove();
            for (let i = 0; i < silb.length; i++) {
                let move = silb[i].getMove();
                if (cur_sgf_coord == silb[i].getMove())
                    continue;
                let pt = this.sgf2pt(move);
                let clr = silb[i].getColor();
                if (!clr)
                    continue;
                this.board.addMarker(pt, "s-stone-" + clr.toLowerCase());
            }
        }

        if (no_render) {
            this.board.commit();

        } else {
            this.find_variations();
            this.board.commit();
            this.board.render();
        }
    }

    /**
     * Resets the game cursor to the first node
    **/
    reset_cursor(no_render) {
        this.board.reset();
        this.reset_current_color();
        this.cursor.node = this.cursor.getGameRoot();
        this.refresh(no_render);
    }

    /**
     * Refresh the current node (and wait until progressive loading is
     * finished before doing so)
    **/
    refresh(no_render) {
        this.board.revert(1);
        this.exec_node(no_render);
    }

    /**
     * Resets the current color as appropriate
    **/
    reset_current_color() {
        this.currentColor = "B";
        if (!this.cursor) return;
        var root = this.cursor.getGameRoot();
        if (root && root.HA > 1)
            this.currentColor = 'W';
    }

    ph_set_color(color) {
        // this.prependComment(color == "B" ? t['black to play'] :
        //     t['white to play']);
        this.currentColor = color;
    }

    ph_add_stone(coord, color) {
        //d// console.log("{editor} add_stone", [coord, color]);
        if (!(coord instanceof Array)) {
            coord = [coord];
        }
        coord = this.expand_compressed_pt(coord);
        for (var i = 0; i < coord.length; i++) {
            this.board.addStone(
                this.sgf2pt(coord[i]),
                color == "AW" ? this.board.WHITE :
                color == "AB" ? this.board.BLACK : this.board.EMPTY
            );
        }
    }

    ph_add_marker(coord, type) {
        if (!(coord instanceof Array)) {
            coord = [coord];
        }
        console.log("AO", [type, coord]);

        if (type == "LN") {
            for (let i = 0; i < coord.length; i++) {
                let c = coord[i];
                this.board.addMarker(
                    this.sgf2pt((c.split(":"))[0]),
                    "line",
                    this.sgf2pt((c.split(":"))[1]),
                );
            }
            return;

        } else if (type == "AR") {
            for (let i = 0; i < coord.length; i++) {
                let c = coord[i];
                this.board.addMarker(
                    this.sgf2pt((c.split(":"))[0]),
                    "arrow",
                    this.sgf2pt((c.split(":"))[1]),
                );
            }
            return;
        }

        coord = this.expand_compressed_pt(coord);
        var label;
        for (var i = 0; i < coord.length; i++) {
            switch (type) {
                case "TR": label = "triangle"; break;
                case "SQ": label = "square"; break;
                case "CR": label = "circle"; break;
                case "MA": label = "ex"; break;
                case "TW": label = "territory-white"; break;
                case "TB": label = "territory-black"; break;
                case "DD": label = "dim"; break;
                case "LB": label = "\x01" + (coord[i].split(":"))[1]; break;
                default: label = type; break;
            }
            this.board.addMarker(
                this.sgf2pt((coord[i].split(":"))[0]),
                label
            );
        }
    }

    ph_show_time(value, type) {
        var tp = ((type == "BL" || type == "OB") ? "timeB" : "timeW");

        if (type == "BL" || type == "WL") {
            var mins = Math.floor(value / 60);
            var secs = (value % 60).toFixed(0);
            secs = (secs < 10 ? "0" : "") + secs;
            this[tp] = mins + ":" + secs;

        } else {
            this[tp] += " (" + value + ")";
        }
    }

    /**
     * Good move, bad move, etc
    **/
    ph_show_annotation(value, type) {
        var msg;
        switch (type) {
            case 'N':  msg = value; break;
            case 'GB': msg = (value > 1 ? t['vgb'] : t['gb']); break;
            case 'GW': msg = (value > 1 ? t['vgw'] : t['gw']); break;
            case 'DM': msg = (value > 1 ? t['dmj'] : t['dm']); break;
            case 'UC': msg = t['uc']; break;
            case 'TE': msg = t['te']; break;
            case 'BM': msg = (value > 1 ? t['vbm'] : t['bm']); break;
            case 'DO': msg = t['do']; break;
            case 'IT': msg = t['it']; break;
            case 'HO': msg = t['ho']; break;
        }
        // todo // this.prependComment(msg);
    }

    ph_show_comments(comments, junk, no_render) {
        if (!comments || no_render) return;
        // TODO // this.dom.comments.innerHTML += comments.replace(/^(\n|\r|\t|\s)+/, "").replace(/\n/g, "<br />");
    }

    get_game_description() {
        var root = this.cursor.getGameRoot();
        if (!root) return;
        var desc = root.GN || this.gameName;
        if (root.PW && root.PB) {
            var wr = root.WR ? " " + root.WR : "";
            var br = root.BR ? " " + root.BR : "";
            desc += (desc.length ? " - " : "") + root.PW + wr + " vs " + root.PB + br;
        }
        return desc;
    }

    /**
     * Play a move on the board and apply rules to it. This is different from
     * merely adding a stone.
    **/
    ph_play_move(coord, color, no_render) {
        //d// console.log("{editor} play_move", [coord, color, no_render]);
        color = color || this.currentColor;
        this.currentColor = (color == "B" ? "W" : "B");
        color = color == "W" ? this.board.WHITE : this.board.BLACK;

        var pt = this.sgf2pt(coord);

        if ((!coord || coord == "tt" || coord == "") && !no_render) {
            // this.prependComment(
            //     (color == this.board.WHITE
            //     ? t['white'] : t['black'])
            //     + " " + t['passed'], "comment-pass");

        } else if (coord == "resign") {
            // this.prependComment(
            //     (color == this.board.WHITE
            //     ? t['white'] : t['black'])
            //     + " " + t['resigned'], "comment-resign");

        } else if (coord && coord != "tt") {
            this.board.addStone(pt, color);
            this.rules.apply(pt, color);

            if (!no_render) {
                this.ph_add_marker(coord, "current");
            }
        }
    }

    sgf2pt(coord) {
        if (!coord || coord == "tt") return { x: null, y: null };
        var coord_map = {
            a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7, i: 8, j: 9,
            k: 10,l: 11, m: 12, n: 13, o: 14, p: 15, q: 16, r: 17, s: 18
        };
        return {
            x: coord_map[coord.charAt(0)],
            y: coord_map[coord.charAt(1)]
        };
    }

    /**
     * Locates any variations within the current node and makes note of their
     * move and index position
     */
    find_variations() {
        this.variations = this.get_variations();
    }

    get_variations() {
        var vars = [],
            kids = this.cursor.node._children;
        for (var i = 0; i < kids.length; i++) {
            vars.push({
                move: kids[i].getMove(),
                varNum: i,
                node: kids[i]
            });
        }
        return vars;
    }

    boundsCheck(x, y, region) {
        if (region.length == 2) {
            region[3] = region[2] = region[1];
            region[1] = region[0];
        }
        return (   x >= region[0] && y >= region[1]
                && x <= region[2] && y <= region[3]);
    }

    pt2sgf(pt) {
        if (!pt || (this.board
                    && !this.boundsCheck(pt.x, pt.y, [0, this.board.boardSize-1]))) {
            return null;
        }
        var pts = {
            0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f', 6: 'g', 7: 'h',
            8: 'i', 9: 'j', 10: 'k', 11: 'l', 12: 'm', 13: 'n', 14: 'o',
            15: 'p', 16: 'q', 17: 'r', 18: 's'
        };
        return pts[pt.x] + pts[pt.y];
    }

    expand_compressed_pt(coords) {
        var new_coords = [];

        for (let i = 0; i < coords.length; i++) {

            let bounds = coords[i].split(/:/);
            if (bounds.length > 1) {
                let ul = this.sgf2pt(bounds[0]);
                let lr = this.sgf2pt(bounds[1]);

                for (let x = ul.x; x <= lr.x; x++) {
                   for (let y = ul.y; y <= lr.y; y++) {
                       new_coords.push(this.pt2sgf({x:x,y:y}));
                   }
                }
            }
       }

       return coords.concat(new_coords);
    }

    next_silbling(no_render) {
        let next = this.cursor.get_next_silbling();
        if (!this.back(true)) return;
        this.variation(next[1]);
    }

    /**
     * If there are no properties left in a node, ask whether to delete it
    **/
    check_for_empty_node_removal() {
        if (!util.num_properties(this.cursor.node.getProperties())) {
            var killNode = window.confirm("Delete node?");
            if (killNode) {
                var id = this.cursor.node._id;
                var index = 0;
                this.back();
                this.cursor.node._children =
                    util.array_filter(this.cursor.node._children, function(node, i) {
                        if (node._id == id) {
                            index = i;
                            return false;
                        } else {
                            return true;
                        }
                    });

                if (index && this.cursor.node._preferredChild == index)
                    this.cursor.node._preferredChild--;

                return true;
            }
        }
        return false;
    }

    user_mark(pos, mark_type) {
        let pt = { x: pos[0], y: pos[1] };
        let coord = this.pt2sgf(pt);

        let prop;
        if (mark_type == "add_b" || mark_type == "add_w") {
            // place black stone, white stone, labels
            let stone = this.board.getStone(pt);
            // if a stone was placed previously, we add an empty point (AE);
            // otherwise, we remove the stone property from the current node
            var deleted = this.cursor.node.emptyPoint(coord);
            if (stone != this.board.BLACK && mark_type == "add_b") {
                prop = "AB";
            } else if (stone != this.board.WHITE && mark_type == "add_w") {
                prop = "AW";
            } else if (this.board.getStone(pt) != this.board.EMPTY && !deleted) {
                prop = "AE";
            }

        } else {

            switch (mark_type) {
                case "tr":  prop = "TR"; break;
                case "sq":  prop = "SQ"; break;
                case "cr":  prop = "CR"; break;
                case "x":   prop = "MA"; break;
                case "dim": prop = "DD"; break;
                case "number":
                    prop = "LB";
                    coord = coord + ":" + this.labelLastNumber;
                    this.labelLastNumber++;
                    break;
                case "letter":
                    prop = "LB";
                    coord = coord + ":" + this.labelLastLetter;
                    this.labelLastLetter = String.fromCharCode(
                        this.labelLastLetter.charCodeAt(0)+1);
                    break;
                case "label":
                    prop = "LB";
                    coord = coord + ":" + this.dom.labelInput.value;
                    break;
                case "clear":
                    this.cursor.node.deletePropertyValue(
                        ['TR', 'SQ', 'CR', 'MA', 'DD', 'LB'], new RegExp("^" + coord));
                    break;
            }

            if (this.cursor.node.hasPropertyValue(prop, coord)) {
                this.cursor.node.deletePropertyValue(prop, coord);
                prop = null;
            }
        }

        if (prop)
            this.cursor.node.pushProperty(prop, coord);

        var deleted = this.check_for_empty_node_removal();

        this.refresh();

        // if (deleted) this.prependComment(t['position deleted']);
    }

    user_play_or_var(pos) {
        let pt = { x: pos[0], y: pos[1] };
        let coord = this.pt2sgf(pt);
        if (!coord) return;

        // TODO: remove this.currentColor, replace it with some
        //       method on cursor that figures the color out
        //       without us having to keep color state...
        let num_clr = this.currentColor == "W"
                      ? this.board.WHITE
                      : this.board.BLACK;
        if (!this.rules.check_with_ko_and_suicide(pt, num_clr)) {
            return;
        }

        var nextMoves = this.cursor.getNextMoves();
        if (nextMoves && coord in nextMoves) {
            this.variation(nextMoves[coord]);
        } else {
            this.create_move(coord);
        }
    }
}
