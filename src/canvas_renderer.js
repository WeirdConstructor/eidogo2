/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2018, Weird Constructor <weirdconstructor@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * New Player code for adapted eidgo code.
 */

export class GoBoardCanvasRenderer {
    constructor(canvas_element, size) {
        this.canvas = canvas_element;
        this.size   = size;
        this.starpoints = [
            [3,  3], [3,  15], [15, 3],
            [15, 15], [3,  9], [15, 9],
            [9,  3], [9,  15], [9,  9]
        ];
        this.line_color = "#766";
        this.board_color = '#ddbc6b';
        this.coords = [
            ['A', '19'],
            ['B', '18'],
            ['C', '17'],
            ['D', '16'],
            ['E', '15'],
            ['F', '14'],
            ['G', '13'],
            ['H', '12'],
            ['J', '11'],
            ['K', '10'],
            ['L', '9'],
            ['M', '8'],
            ['N', '7'],
            ['O', '6'],
            ['P', '5'],
            ['Q', '4'],
            ['R', '3'],
            ['S', '2'],
            ['T', '1'],
        ];

        this.start_redraw();
    }

    set_size(size) {
        this.size = size;
    }

    clear_draw_cache() {
        for (let i = 0; i < 19; i++) {
            this.coords[i][2] = null;
            this.coords[i][3] = null;
        }
    }

    mouse2board(cl_x, cl_y) {
        let cr = this.canvas.getBoundingClientRect();
        let x = cl_x - cr.x;
        let y = cl_y - cr.y;

        if (!this.liv)
            return null;

        let bx = Math.floor(((x - this.field_offs) + this.liv / 2) / this.liv);
        let by = Math.floor(((y - this.field_offs) + this.liv / 2) / this.liv);

        if (bx < 0 || bx > 18) return null;
        if (by < 0 || by > 18) return null;

        return [bx, by];
    }

    change_canvas_size(width_px) {
        this.canvas.width  = width_px;
        this.canvas.height = width_px;
    }

    start_redraw() {
        this.draw_stone_b_list = [];
        this.draw_stone_w_list = [];
        this.draw_marker_list = [];
    }

    draw_stone(x, y, color) {
        if (color == "white") {
            this.draw_stone_w_list.push([x, y]);
        } else {
            this.draw_stone_b_list.push([x, y]);
        }
    }

    draw_marker(x, y, marker, color, p2) {
        this.draw_marker_list.push([x, y, marker, color, p2]);
    }

    draw_stone_list(ctx, list, edge_clr, color, offs) {
        if (offs == null) offs = 0;

        let liv = this.liv;
        let stone_size = Math.floor(liv / 2) - 1;
        if (stone_size < 0) stone_size = 1;

        ctx.beginPath();
        for (let i = 0; i < list.length; i++) {
            let x = list[i][0];
            let y = list[i][1];
            ctx.moveTo(offs + x * liv + stone_size, offs + y * liv)
            ctx.arc(offs + x * liv, offs + y * liv, stone_size, 0, Math.PI * 2);
        }

        ctx.fillStyle = color;
        ctx.strokeStyle = edge_clr;
        ctx.lineCap = "round";
        ctx.fill();
        if (edge_clr) {
            ctx.stroke();
        }
    }

    finish_redraw() {
        this.redraw();
    }

    redraw_board_background(cv_size_px) {
        this.board_canvas = document.createElement("canvas");
        let canvas = this.board_canvas;
        this.board_canvas.width = cv_size_px;
        this.board_canvas.height = cv_size_px;

        let line_color       = this.line_color;
        let line_width_px    = cv_size_px / 600;
        this.line_width_px   = line_width_px;
        let star_point_px    = Math.ceil(cv_size_px / 200);
        let coord_size_px    = Math.ceil(cv_size_px / 30);
        let pad              = Math.ceil(cv_size_px / 100);
        let size_px          = cv_size_px - 2 * (coord_size_px + pad);
        let board_line_count = this.size;

        let liv         = Math.floor(size_px / board_line_count);
        this.liv        = liv;
        let field_offs  = Math.ceil(liv / 2 + pad + coord_size_px);
        this.field_offs = field_offs;

        let line_len = liv * (board_line_count - 1);
        this.size_px = size_px = liv * board_line_count;

        let ctx = canvas.getContext("2d");
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(0.5, 0.5);
        ctx.lineWidth = line_width_px;

        ctx.strokeStyle = line_color;
        ctx.fillStyle = this.board_color;
        ctx.fillRect(
            0, 0,
            size_px + 2 * (pad + coord_size_px),
            size_px + 2 * (pad + coord_size_px));
        ctx.lineCap = "square";
        ctx.beginPath();
        ctx.translate(field_offs, field_offs);
        for (let i = 0; i < 19; i++) {
            ctx.moveTo(liv * i,  0);
            ctx.lineTo(liv * i,  line_len);
            ctx.moveTo(0,        liv * i);
            ctx.lineTo(line_len, liv * i);
        }

        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = line_color;
        for (let i = 0; i < this.starpoints.length; i++) {
            let x = this.starpoints[i][0];
            let y = this.starpoints[i][1];
            ctx.moveTo(x * liv, y * liv)
            ctx.arc(x * liv, y * liv, star_point_px, 0, Math.PI * 2);
        }
        ctx.fill();

        let fontsize = coord_size_px * 0.75;
        this.font_size = fontsize;
        ctx.font = 'bold ' + fontsize + 'px sans-serif';

        if (!this.coords[0][2]) {
            for (let i = 0; i < 19; i++) {
                this.coords[i][2] = ctx.measureText(this.coords[i][0]);
                this.coords[i][3] = ctx.measureText(this.coords[i][1]);
            }
        }

        ctx.fillStyle = line_color;
        ctx.textBaseline = 'middle';
        let coord_offs = (coord_size_px / 2) + (liv / 2);
        for (let i = 0; i < 19; i++) {
            ctx.fillText(this.coords[i][0],
                i * liv - (this.coords[i][2].width / 2),
                -coord_offs);
            ctx.fillText(this.coords[i][1],
                -(this.coords[i][3].width / 2) - coord_offs,
                i * liv);
            ctx.fillText(this.coords[i][0],
                i * liv - (this.coords[i][2].width / 2),
                line_len + coord_offs);
            ctx.fillText(this.coords[i][1],
                -(this.coords[i][3].width / 2) + coord_offs + line_len,
                i * liv);
        }

        ctx.restore();
    }

    redraw() {
        let canvas = this.canvas;
        let cv_size_px =
            canvas.width < canvas.height ? canvas.width : canvas.height;
        if (this.last_size_px != cv_size_px) {
            this.clear_draw_cache();
            this.last_size_px = cv_size_px;
            this.redraw_board_background(cv_size_px);
        }

        let liv = this.liv;
        let ctx = canvas.getContext("2d");
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.board_canvas, 0, 0);
        ctx.translate(this.field_offs + 0.5, this.field_offs + 0.5);
        ctx.lineWidth = this.line_width_px;

        this.draw_stone_list(ctx, this.draw_stone_b_list, null,   "#333", liv / 20);
        this.draw_stone_list(ctx, this.draw_stone_b_list, "#555", "#000");
        this.draw_stone_list(ctx, this.draw_stone_w_list, null,   "#333", liv / 20);
        this.draw_stone_list(ctx, this.draw_stone_w_list, "#999", "#fff");

        ctx.textBaseline = 'middle';
        let fontsize = this.font_size;

        for (let i = 0; i < this.draw_marker_list.length; i++) {
            ctx.save();
            let m = this.draw_marker_list[i];
            if (m[2].substr(0, 1) == "\x01") {
                let str = m[2].substr(1);

                ctx.lineWidth    = fontsize / 6;
                ctx.lineCap      = "round";
                ctx.lineJoin     = "round";
                ctx.fillStyle    = "#fff";
                ctx.strokeStyle  = "#000";
                ctx.font = "" + fontsize + "px sans-serif";
                let mt = ctx.measureText(str);
                if (mt.width > liv) {
                    ctx.font = "" + (fontsize * 0.6) + "px sans-serif";
                    mt = ctx.measureText(str);
                }
                let ox = mt.width / 2;
                if (ox > (liv / 2)) ox = liv / 2;
                ctx.strokeText(str, m[0] * liv - ox, m[1] * liv);
                ctx.fillText(  str, m[0] * liv - ox, m[1] * liv);

            } else if (m[2] == "triangle") {
                let side = liv * 0.6;
                let h = side * (Math.sqrt(3)/2);
                ctx.beginPath();
                ctx.lineJoin     = "miter";
                ctx.strokeStyle  = m[3] == "black" ? "#fff" : "#000";
                ctx.lineCap      = "butt";
                ctx.lineWidth    = fontsize / 8;
                ctx.translate(m[0] * liv, m[1] * liv -(h / 9));
                ctx.moveTo(0, -h / 2);
                ctx.lineTo(-side / 2, h / 2);
                ctx.lineTo(side / 2, h / 2);
                ctx.lineTo(0, -h / 2);
                ctx.closePath();
                ctx.stroke();

            } else if (m[2] == "ex") {
                let r = (liv / 2) * 0.5;
                if (m[2] == "current") r *= 0.7;

                ctx.beginPath();
                ctx.lineWidth    = fontsize / 8;
                ctx.strokeStyle  = m[3] == "black" ? "#fff" : "#000";
                ctx.lineJoin     = "miter";
                ctx.lineCap      = "round";
                ctx.moveTo(m[0] * liv - r, m[1] * liv - r);
                ctx.lineTo(m[0] * liv + r, m[1] * liv + r);
                ctx.moveTo(m[0] * liv - r, m[1] * liv + r);
                ctx.lineTo(m[0] * liv + r, m[1] * liv - r);
                ctx.stroke();

            } else if (m[2] == "square") {
                let r = (liv / 2) * 0.5;
                if (m[2] == "current") r *= 0.7;

                ctx.beginPath();
                ctx.lineWidth    = fontsize / 8;
                ctx.strokeStyle  = m[3] == "black" ? "#fff" : "#000";
                ctx.lineJoin     = "miter";
                ctx.lineCap      = "round";
                ctx.moveTo(m[0] * liv - r, m[1] * liv - r);
                ctx.lineTo(m[0] * liv + r, m[1] * liv - r);
                ctx.lineTo(m[0] * liv + r, m[1] * liv + r);
                ctx.lineTo(m[0] * liv - r, m[1] * liv + r);
                ctx.closePath();
                ctx.stroke();

            } else if (   m[2] == "circle"
                       || m[2] == "current"
                       || m[2] == "s-stone-b"
                       || m[2] == "s-stone-w") {
                let r = (liv / 2) * 0.5;
                if (m[2] == "current") r *= 0.7;

                ctx.beginPath();
                ctx.lineWidth    = fontsize / 8;
                if (m[2].substr(0, 2) == "s-")
                    ctx.strokeStyle  = m[2].substr(8) == "b" ? "#000" : "#fff";
                else
                    ctx.strokeStyle  = m[3] == "black" ? "#fff" : "#000";
                ctx.fillStyle    = ctx.strokeStyle;
                ctx.lineJoin     = "miter";
                ctx.lineCap      = "round";
                ctx.moveTo(m[0] * liv + r, m[1] * liv);
                ctx.arc(m[0] * liv, m[1] * liv, r, 0, Math.PI * 2);

                if (m[2].substr(0, 2) == "s-")
                    ctx.fill();
                else
                    ctx.stroke();

            } else if (m[2] == "line" || m[2] == "arrow") {
                let p2 = m[4];
                ctx.beginPath();
                ctx.lineWidth = fontsize / 8;
                ctx.strokeStyle = "#F00";
                ctx.moveTo(m[0] * liv, m[1] * liv);
                ctx.lineTo(p2.x * liv, p2.y * liv);
                ctx.stroke();

                if (m[2] == "arrow") {
                    ctx.beginPath();
                    ctx.lineWidth = fontsize / 8;
                    ctx.strokeStyle = "#F00";
                    ctx.arc(p2.x * liv, p2.y * liv, ctx.lineWidth * 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.stroke();
                }

            } else {
                console.log("{renderer} unknown marker", m);
            }

            ctx.restore();
        }

        ctx.restore();
    }
}


