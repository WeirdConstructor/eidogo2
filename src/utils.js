/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Copyright (c) 2018, Weird Constructor <weirdconstructor@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * Utility functions.
 */

export function array_filter(obj, fun /*, thisp*/)
{
    var len = obj.length;
    if (typeof fun != "function")
        throw new TypeError();

    var res = new Array();
    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
        if (i in obj)
        {
            var val = obj[i]; // in case fun mutates obj
            if (fun.call(thisp, val, i, obj))
              res.push(val);
        }
    }

    return res;
}

export function num_properties(obj) {
    var count = 0;
    for (var i in obj) count++;
    return count;
}
