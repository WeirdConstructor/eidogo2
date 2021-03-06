/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Copyright (c) 2018, Weird Constructor <weirdconstructor@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * This file contains GameNode and GameCursor.
 */

/**
 * For uniquely identifying nodes. Should work even if we have
 * multiple Player instantiations. Setting this to 100000 is kind of a hack
 * to avoid overlap with ids of as-yet-unloaded trees.
 */
let gameNodeIdCounter = 100000;

/**
 * @class GameNode holds SGF-like data containing things like moves, labels
 * game information, and so on. Each GameNode has children and (usually) a
 * parent. The first child is the main line.
 */
export class GameNode {
    /**
     * @constructor
     * @param {GameNode} parent Parent of the node
     * @param {Object} properties SGF-like JSON object to load into the node
     */
    constructor(parent, properties, id) {
        this._id             = (typeof id != "undefined"
                                ? id
                                : gameNodeIdCounter++);
        this._parent         = parent || null;
        this._children       = [];
        this._preferredChild = 0;
        if (properties)
            this.load_json(properties);
    }

    /**
     * Adds a property to this node without replacing existing values. If
     * the given property already exists, it will make the value an array
     * containing the given value and any existing values.
    **/
    pushProperty(prop, value) {
        if (this[prop]) {
            if (!(this[prop] instanceof Array))
                this[prop] = [this[prop]];
            if (!this[prop].includes(value))
                this[prop].push(value);
        } else {
            this[prop] = value;
        }
    }

    /**
     * Check whether this node contains the given property with the given
     * value
    **/
    hasPropertyValue(prop, value) {
        if (!this[prop]) return false;
        var values = (this[prop] instanceof Array ? this[prop] : [this[prop]]);
        return values.includes(value);
    }

    /**
     * Removes a value from property or properties. If the value is the only
     * one for the property, removes the property also. Value can be a RegExp
     * or a string
    **/
    deletePropertyValue(prop, value) {
        var test = (value instanceof RegExp) ?
            function(v) { return value.test(v); } :
            function(v) { return value == v; };
        var props = (prop instanceof Array ? prop : [prop]);
        for (var i = 0; prop = props[i]; i++) {
            if (this[prop] instanceof Array) {
                this[prop] = this[prop].filter(function(v) { return !test(v); });
                if (!this[prop].length) delete this[prop];
            } else if (test(this.prop)) {
                delete this[prop];
            }
        }
    }

    /**
     * Loads SGF-like data given in JSON format:
     *      {PROP1: VALUE, PROP2: VALUE, _children: [...]}
     * Node properties will be overwritten if they exist or created if they
     * don't.
     *
     * We use a stack instead of recursion to avoid recursion limits.
    **/
    load_json(data) {
        var jsonStack = [data], gameStack = [this];
        var jsonNode, gameNode;
        var i, len;
        while (jsonStack.length) {
            jsonNode = jsonStack.pop();
            gameNode = gameStack.pop();
            gameNode.loadJsonNode(jsonNode);
            len = (jsonNode._children ? jsonNode._children.length : 0);
            for (i = 0; i < len; i++) {
                jsonStack.push(jsonNode._children[i]);
                if (!gameNode._children[i])
                    gameNode._children[i] = new GameNode(gameNode);
                gameStack.push(gameNode._children[i]);
            }
        }
    }

    /**
     * Adds properties to the current node from a JSON object
    **/
    loadJsonNode(data) {
        for (var prop in data) {
            if (prop == "_id") {
                this[prop] = data[prop].toString();
                gameNodeIdCounter = Math.max(gameNodeIdCounter, parseInt(data[prop], 10));
                continue;
            }
            if (prop.charAt(0) != "_")
                this[prop] = data[prop];
        }
    }

    /**
     * Add a new child (variation)
    **/
    appendChild(node) {
        node._parent = this;
        this._children.push(node);
        return (this._children.length - 1);
    }

    /**
     * Returns all the properties for this node
    **/
    getProperties() {
        var properties = {}, propName, isReserved, isString, isArray;
        for (propName in this) {
            let isPrivate = (propName.charAt(0) == "_");
            let isString = (typeof this[propName] == "string");
            let isArray = (this[propName] instanceof Array);
            if (!isPrivate && (isString || isArray))
                properties[propName] = this[propName];
        }
        return properties;
    }

    /**
     * Applies \a fn to all nodes up to the current node,
     * starting from the root node.
    **/
    walk_up(fn, n) {
        if (!n) return;
        walk_up(fn, n._parent);
        fn(n);
    }

    /**
     * Applies a function to this node and all its children, recursively
     * (although we use a stack instead of actual recursion)
    **/
    walk(fn, thisObj) {
        var stack = [this];
        var node;
        var i, len;
        while (stack.length) {
            node = stack.pop();
            fn.call(thisObj || this, node);
            len = (node._children ? node._children.length : 0);
            for (i = 0; i < len; i++)
                stack.push(node._children[i]);
        }
    }

    /**
     * Get the color of the current move. Whether it is "W" or "B".
     * Position can be retrieved using node.getMove()
    **/
    getColor() {
        if (this.W || this.B)
            return this.W ? "W" : "B";
        return null;
    }

    /**
     * Get the current black or white move as a raw SGF coordinate
    **/
    getMove() {
        if      (this.W != null) return this.W;
        else if (this.B != null) return this.B;
        return null;
    }

    /**
     * Returns a list of all silbling nodes or null.
    **/
    getSilblings() {
        if (!this._parent) return [];
        return this._parent._children;
    }

    /**
     * Empty the current node of any black or white stones (played or added)
    **/
    emptyPoint(coord) {
        var props = this.getProperties();
        var deleted = null;
        for (var propName in props) {
            if (propName == "AW" || propName == "AB" || propName == "AE") {
                if (!(this[propName] instanceof Array))
                    this[propName] = [this[propName]];
                    this[propName] = this[propName].filter(function(val) {
                        if (val == coord) {
                            deleted = val;
                            return false;
                        }
                        return true;
                    });
                if (!this[propName].length)
                    delete this[propName];
            } else if ((propName == "B" || propName == "W") && this[propName] == coord) {
                deleted = this[propName];
                delete this[propName];
            }
        }
        return deleted;
    }

    /**
     * Returns the node's position in its parent's _children array
    **/
    getPosition() {
        if (!this._parent) return null;
        var siblings = this._parent._children;
        for (var i = 0; i < siblings.length; i++)
            if (siblings[i]._id == this._id) {
                return i;
            }
        return null;
    }

    /**
     * Converts this node and all children to SGF
    **/
    toSgf() {
        var sgf = (this._parent ? "(" : "");
        var node = this;

        function propsToSgf(props) {
            if (!props) return "";
            var sgf = ";", key, val;
            for (key in props) {
                if (props[key] instanceof Array) {
                    val = props[key].map(function (val) {
                        return val.toString().replace(/\]/g, "\\]");
                    }).join("][");
                } else {
                    val = props[key].toString().replace(/\]/g, "\\]");
                }
                sgf += key + "[" + val  + "]";
            }
            return sgf;
        }

        sgf += propsToSgf(node.getProperties());

        // Follow main line until we get to a node with multiple variations
        while (node._children.length == 1) {
            node = node._children[0];
            sgf += propsToSgf(node.getProperties());
        }

        // Variations
        for (var i = 0; i < node._children.length; i++) {
            sgf += node._children[i].toSgf();
        }

        sgf += (this._parent ? ")" : "");

        return sgf;
    }
}

/**
 * @class GameCursor is used to navigate among the nodes of a game tree.
 */
export class GameCursor {
    /**
     * @constructor
     * @param {GameNode} A node to start with
     */
    constructor(node) {
        this.node = node;
    }

    next(varNum) {
        if (!this.hasNext()) return false;
        varNum = (varNum == null ?  this.node._preferredChild : varNum);
        this.node._preferredChild = varNum;
        this.node = this.node._children[varNum];
        return true;
    }

    get_next_silbling() {
        let silb = this.node.getSilblings();
        let next = null;
        let cur_silb = this.node.getMove();

        for (let i = 0; i < silb.length; i++) {
            if (silb[i].getMove() == cur_silb) {
                if ((i + 1) >= silb.length) {
                    next = [silb[0], 0];
                } else {
                    next = [silb[i + 1].getMove(), i + 1];
                }
                break;
            }
        }

        return next;
    }

    previous() {
        if (!this.hasPrevious()) return false;
        this.node = this.node._parent;
        return true;
    }

    hasNext() {
        return this.node && this.node._children.length;
    }

    hasPrevious() {
        // Checking _parent of _parent is to prevent returning to root
        return this.node && this.node._parent && this.node._parent._parent;
    }

    getNextMoves() {
        if (!this.hasNext()) return null;
        var moves = {};
        var i, node;
        for (i = 0; node = this.node._children[i]; i++)
            moves[node.getMove()] = i;
        return moves;
    }

    getNextColor() {
        if (!this.hasNext()) return null;
        var node;
        for (let i = 0; node = this.node._children[i]; i++) {
            let clr = node.getColor();
            if (clr) return clr;
        }
        return null;
    }

    getNextNodeWithVariations() {
        var node = this.node;
        while (node._children.length == 1)
            node = node._children[0];
        return node;
    }

    getPath() {
        var n = this.node,
            rpath = [],
            mn = 0;
        while (n && n._parent && n._parent._children.length == 1 && n._parent._parent) {
            mn++;
            n = n._parent;
        }
        rpath.push(mn);
        while (n) {
            if (n._parent && (n._parent._children.length > 1 || !n._parent._parent))
                rpath.push(n.getPosition() || 0);
            n = n._parent;
        }
        return rpath.reverse();
    }

    getPathMoves() {
        var path = [];
        var cur = new GameCursor(this.node);
        path.push(cur.node.getMove());
        while (cur.previous()) {
            var move = cur.node.getMove();
            if (move) path.push(move);
        }
        return path.reverse();
    }

    get_max_move_count() {
        let c = new GameCursor(this.node);
        let count = 0;
        while (c.next()) { count++; }
        return count;
    }

    getMoveNumber() {
        var num = 0,
            node = this.node;
        while (node) {
            if (node.W || node.B) num++;
            node = node._parent;
        }
        return num;
    }

    getGameRoot() {
        if (!this.node) return null;
        var cur = new GameCursor(this.node);
        // If we're on the tree root, return the first game
        if (!this.node._parent && this.node._children.length)
            return this.node._children[0];
        while (cur.previous()) {};
        return cur.node;
    }
};
