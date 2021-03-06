(function(f, define){
    define([ "./kendo.core" ], f);
})(function(){

var __meta__ = { // jshint ignore:line
    id: "maskedtextbox",
    name: "MaskedTextBox",
    category: "web",
    description: "The MaskedTextBox widget allows to specify a mask type on an input field.",
    depends: [ "core" ]
};

(function($, undefined) {
    var global = window;
    var abs = global.Math.abs;
    var Array = global.Array;
    var kendo = global.kendo;
    var caret = kendo.caret;
    var keys = kendo.keys;
    var Class = kendo.Class;
    var isFunction = kendo.isFunction;
    var ui = kendo.ui;
    var Widget = ui.Widget;
    var ns = ".kendoMaskedTextBox";
    var proxy = $.proxy;

    var INPUT_EVENT_NAME = (kendo.support.propertyChangeEvent ? "propertychange" : "input") + ns;
    var STATEDISABLED = "k-state-disabled";
    var DISABLED = "disabled";
    var READONLY = "readonly";
    var CHANGE = "change";

    function matchesRule(character, rule) {
        if (rule && ((rule.test && rule.test(character)) || (isFunction(rule) && rule(character)))) {
            return true;
        } else {
            return false;
        }
    }

    function replaceCharAt(index, character, string) {
        var chars = [];

        if (isString(character) && isString(string) && index >= 0 && index < string.length) {
            chars = string.split("");
            chars[index] = character;
        }

        return chars.join("");
    }

    function isString(value) {
        return (typeof value === "string");
    }

    var MaskedTextBox = Widget.extend({
        init: function(element, options) {
            var that = this;
            var DOMElement;

            Widget.fn.init.call(that, element, options);

            that._rules = $.extend({}, that.rules, that.options.rules);

            element = that.element;
            DOMElement = element[0];

            that.wrapper = element;
            that._tokenize();
            that._form();

            that.element
                .addClass("k-textbox")
                .attr("autocomplete", "off")
                .on("focus" + ns, function() {
                    var value = DOMElement.value;

                    if (!value) {
                        DOMElement.value = that._old = that._emptyMask;
                    } else {
                        that._togglePrompt(true);
                    }

                    that._oldValue = value;

                    that._timeoutId = setTimeout(function() {
                        caret(element, 0, value ? that._maskLength : 0);
                    });
                })
                .on("focusout" + ns, function() {
                    var value = element.val();

                    clearTimeout(that._timeoutId);
                    DOMElement.value = that._old = "";

                    if (value !== that._emptyMask) {
                        DOMElement.value = that._old = value;
                    }

                    that._change();
                    that._togglePrompt();
                });

             var disabled = element.is("[disabled]") || $(that.element).parents("fieldset").is(':disabled');

             if (disabled) {
                 that.enable(false);
             } else {
                 that.readonly(element.is("[readonly]"));
             }

             that.value(that.options.value || element.val());

             kendo.notify(that);
        },

        options: {
            name: "MaskedTextBox",
            clearPromptChar: false,
            unmaskOnPost: false,
            promptChar: "_",
            culture: "",
            rules: {},
            value: "",
            mask: ""
        },

        events: [
            CHANGE
        ],

        rules: {
            "0": /\d/,
            "9": /\d|\s/,
            "#": /\d|\s|\+|\-/,
            "L": /[a-zA-Z]/,
            "?": /[a-zA-Z]|\s/,
            "&": /\S/,
            "C": /./,
            "A": /[a-zA-Z0-9]/,
            "a": /[a-zA-Z0-9]|\s/
        },

        setOptions: function(options) {
            var that = this;

            Widget.fn.setOptions.call(that, options);

            that._rules = $.extend({}, that.rules, that.options.rules);

            that._tokenize();

            this._unbindInput();
            this._bindInput();

            that.value(that.element.val());
        },

        destroy: function() {
            var that = this;

            that.element.off(ns);

            if (that._formElement) {
                that._formElement.off("reset", that._resetHandler);
                that._formElement.off("submit", that._submitHandler);
            }

            Widget.fn.destroy.call(that);
        },

        raw: function() {
            var unmasked = this._unmask(this.element.val(), 0);
            return unmasked.replace(new RegExp(this.options.promptChar, "g"), "");
        },

        value: function(value) {
            var element = this.element;
            var emptyMask = this._emptyMask;

            if (value === undefined) {
                return this.element.val();
            }

            if (value === null) {
                value = "";
            }

            if (!emptyMask) {
                this._oldValue = value;
                element.val(value);
                return;
            }

            value = this._unmask(value + "");

            element.val(value ? emptyMask : "");

            this._mask(0, this._maskLength, value);
            this._unmaskedValue = null;

            value = element.val();
            this._oldValue = value;

            if (kendo._activeElement() !== element) {
                if (value === emptyMask) {
                    element.val("");
                } else {
                    this._togglePrompt();
                }
            }
        },

        _togglePrompt: function(show) {
            var DOMElement = this.element[0];
            var value = DOMElement.value;

            if (this.options.clearPromptChar) {
                if (!show) {
                    value = value.replace(new RegExp(this.options.promptChar, "g"), " ");
                } else {
                    value = this._oldValue;
                }

                DOMElement.value = this._old = value;
            }
        },

        readonly: function(readonly) {
            this._editable({
                readonly: readonly === undefined ? true : readonly,
                disable: false
            });
        },

        enable: function(enable) {
            this._editable({
                readonly: false,
                disable: !(enable = enable === undefined ? true : enable)
            });
        },

        _bindInput: function() {
            var that = this;

            if (that._maskLength) {
                that.element
                    .on("keydown" + ns, proxy(that._keydown, that))
                    .on("keypress" + ns, proxy(that._keypress, that))
                    .on("paste" + ns, proxy(that._paste, that))
                    .on(INPUT_EVENT_NAME, proxy(that._propertyChange, that));
            }
        },

        _unbindInput: function() {
            this.element
                .off("keydown" + ns)
                .off("keypress" + ns)
                .off("paste" + ns)
                .off(INPUT_EVENT_NAME);
        },

        _editable: function(options) {
            var that = this;
            var element = that.element;
            var disable = options.disable;
            var readonly = options.readonly;

            that._unbindInput();

            if (!readonly && !disable) {
                element.removeAttr(DISABLED)
                       .removeAttr(READONLY)
                       .removeClass(STATEDISABLED);

                that._bindInput();
            } else {
                element.attr(DISABLED, disable)
                       .attr(READONLY, readonly)
                       .toggleClass(STATEDISABLED, disable);
            }
        },

        _change: function() {
            var that = this;
            var value = that.value();

            if (value !== that._oldValue) {
                that._oldValue = value;

                that.trigger(CHANGE);
                that.element.trigger(CHANGE);
            }
        },

        _propertyChange: function() {
            var that = this;
            var element = that.element[0];
            var value = element.value;
            var unmasked;
            var start;

            if (kendo._activeElement() !== element) {
                return;
            }

            if (value !== that._old && !that._pasting) {
                var d = value.length - that._old.length;
                if(d > 0)  { //typing on a windows phone (lack of keypress; should handle input in the "input" event)
                    var selection = caret(element);

                    var next = selection[0];
                    start = next - d;
                    var content = value.substr(start, d);
                    element.value = value.substring(0, start) + value.substring(next);

                    this._mask(start, start, content);
                }
                else {
                    start = caret(element)[0];
                    unmasked = that._unmask(value.substring(start), start);

                    element.value = that._old = value.substring(0, start) + that._emptyMask.substring(start);

                    that._mask(start, start, unmasked);
                    caret(element, start);
                }
            }
        },

        _paste: function(e) {
            var that = this;
            var element = e.target;
            var position = caret(element);
            var start = position[0];
            var end = position[1];

            var unmasked = that._unmask(element.value.substring(end), end);

            that._pasting = true;

            setTimeout(function() {
                var pasted = element.value.substring(start, caret(element)[0]);
                that._insertString(start, end, pasted, unmasked);
                that._pasting = false;
            });
        },

        _form: function() {
            var that = this;
            var element = that.element;
            var formId = element.attr("form");
            var form = formId ? $("#" + formId) : element.closest("form");

            if (form[0]) {
                that._resetHandler = function() {
                    setTimeout(function() {
                        that.value(element[0].value);
                    });
                };

                that._submitHandler = function() {
                    that.element[0].value = that._old = that.raw();
                };

                if (that.options.unmaskOnPost) {
                    form.on("submit", that._submitHandler);
                }

                that._formElement = form.on("reset", that._resetHandler);
            }
        },

        _insertString : function(start, end, insertString, unmasked, trimPrompt) {
            var that = this;
            var element = that.element[0];
            var value = element.value;

            element.value = that._old = value.substring(0, start) + that._emptyMask.substring(start);
            that._mask(start, start, insertString);

            if(trimPrompt && start !== caret(element)[0] && unmasked[0] === that.options.promptChar) {
                unmasked = unmasked.substring(1);
            }

            start = caret(element)[0];
            that._mask(start, start, unmasked);
            caret(element, start);
        },

        _keydown: function(e) {
            var key = e.keyCode;
            var element = this.element[0];
            var selection = caret(element);
            var start = selection[0];
            var end = selection[1];
            var placeholder;

            var backward = key === keys.BACKSPACE;

            if (backward || key === keys.DELETE) {
                if (start === end) {
                    if (backward) {
                        start -= 1;
                    } else {
                        end += 1;
                    }

                    placeholder = this._find(start, backward);
                }

                if (placeholder !== undefined && placeholder !== start) {
                    if (backward) {
                        placeholder += 1;
                    }

                    caret(element, placeholder);
                } else if (start > -1) {
                    this._mask(start, end, "", backward);
                }

                e.preventDefault();
            } else if (key === keys.ENTER) {
                this._change();
            }
        },

        _keypress: function(e) {
            if (e.which === 0 || e.metaKey || e.ctrlKey || e.keyCode === keys.ENTER) {
                return;
            }

            var character = String.fromCharCode(e.which);
            var selection = caret(this.element);
            var unmasked = this._unmask(this.element.val().substring(selection[1]), selection[1]);

            this._insertString(selection[0], selection[1], character, unmasked, true);

            if (e.keyCode === keys.BACKSPACE || character) {
                e.preventDefault();
            }
        },

        _find: function(idx, backward) {
            var value = this.element.val() || this._emptyMask;
            var step = 1;
            var tokens = this.tokens;

            if (backward === true) {
                step = -1;
            }

            while (idx > -1 || idx <= this._maskLength) {
                if ((!tokens[idx] || tokens[idx].group) || value.charAt(idx) !== tokens[idx].text) {
                    return idx;
                }

                idx += step;
            }

            return -1;
        },

        _mask: function(start, end, value, backward) {
            var element = this.element[0];
            var current = element.value || this._emptyMask;
            var empty = this.options.promptChar;
            var valueLength;
            var chrIdx = 0;
            var unmasked;
            var chr;
            var idx;

            start = this._find(start, backward);

            if (start > end) {
                end = start;
            }

            unmasked = this._unmask(current.substring(end), end);
            value = this._unmask(value, start);
            valueLength = value.length;

            if (value) {
                unmasked = unmasked.replace(new RegExp("^_{0," + valueLength + "}"), "");
            }

            value += unmasked;
            current = current.split("");
            chr = value.charAt(chrIdx);

            while (start < this._maskLength) {
                current[start] = chr || empty;
                chr = value.charAt(++chrIdx);

                if (idx === undefined && chrIdx > valueLength) {
                    idx = start;
                }

                start = this._find(start + 1);
            }

            element.value = this._old = current.join("");

            if (kendo._activeElement() === element) {
                if (idx === undefined) {
                    idx = this._maskLength;
                }

                caret(element, idx);
            }
        },

        _unmask: function(value, idx) {
            var that = this;
            var oldValue = that._oldValue;

            if (!value) {
                return "";
            }

            if(this._unmaskedValue === value) {
                return this._unmaskedValue;
            }

            var chr;
            var token;
            var tokens = that.tokens;
            var tokenRule;
            var tokenGroup;
            var chrIdx = 0;
            var tokenIdx = idx || 0;
            var empty = this.options.promptChar;
            var valueLength = value.length;
            var tokensLength = tokens.length;
            var result = "";
            var charIndexInGroup;
            var currentGroupValue;
            var newGroupValue;
            var currentValue;

            while (tokenIdx < tokensLength) {
                chr = value[chrIdx];
                token = tokens[tokenIdx];
                tokenRule = token.rule;
                tokenGroup = token.group;

                if (!tokenGroup && ((!tokenRule && chr === token.text) || chr === empty)) {
                    result += chr === empty ? empty : "";

                    chrIdx += 1;
                    tokenIdx += 1;
                } else if (tokenRule) {
                    if (matchesRule(chr, tokenRule)) {
                        result += chr;
                        tokenIdx += 1;
                    }

                    chrIdx += 1;
                } else if (tokenGroup) {
                    currentValue = oldValue ? (oldValue.length > valueLength ? oldValue : value) : value;
                    currentGroupValue = currentValue.substr(tokenGroup.maskIndex, tokenGroup.text.length);

                    //partially unmask in the middle of a group
                    if (that._emptyMask.length !== valueLength) {
                        charIndexInGroup = abs(token.maskIndex - token.group.maskIndex);
                        newGroupValue = replaceCharAt(charIndexInGroup, chr, currentGroupValue);

                        if (matchesRule(newGroupValue, tokenGroup.rule)) {
                            result += chr;
                            tokenIdx += 1;
                        }

                        chrIdx += 1;
                    } else {
                        //unmask the whole group
                        if (matchesRule(currentGroupValue, tokenGroup.rule)) {
                            result += currentGroupValue;
                            tokenIdx += currentGroupValue.length;
                        }

                        chrIdx += currentGroupValue.length;
                    }
                } else {
                    tokenIdx += 1;
                }

                if (chrIdx >= valueLength) {
                    break;
                }
            }
            this._unmaskedValue = result;
            return result;
        },

        _tokenize: function() {
            var that = this;
            var tokens = [];
            var tokenIdx = 0;

            var mask = this.options.mask || "";
            var maskChars = mask.split("");
            var length = maskChars.length;
            var idx;
            var chr;
            var rule;

            var emptyMask = "";
            var promptChar = this.options.promptChar;
            var numberFormat = kendo.getCulture(this.options.culture).numberFormat;
            var rules = this._rules;
            var groupTokens;
            var group;
            var groupLength;

            for (idx = 0; idx < length; idx++) {
                chr = maskChars[idx];
                rule = rules[chr];
                group = rule ? null : that._isPartOfMaskGroup(chr, idx);

                if (rule) {
                    tokens[tokenIdx] = new MaskToken({
                        maskIndex: idx,
                        text: chr,
                        rule: rule
                    });
                    emptyMask += promptChar;
                    tokenIdx += 1;
                } else if (group) {
                    groupTokens = that._tokenizeMaskGroup(group);
                    tokens = tokens.concat(groupTokens);

                    groupLength = groupTokens.length;

                    tokenIdx += groupLength;
                    idx += groupLength - 1;
                    emptyMask += Array(groupLength + 1).join(promptChar);
                } else {
                    if (chr === "." || chr === ",") {
                        chr = numberFormat[chr];
                    } else if (chr === "$") {
                        chr = numberFormat.currency.symbol;
                    } else if (chr === "\\") {
                        idx += 1;
                        chr = maskChars[idx];
                    }

                    chr = chr.split("");

                    for (var i = 0, l = chr.length; i < l; i++) {
                        tokens[tokenIdx] = new MaskToken({
                            maskIndex: idx,
                            text: chr[i]
                        });
                        emptyMask += chr[i];
                        tokenIdx += 1;
                    }
                }
            }

            this.tokens = tokens;

            this._emptyMask = emptyMask;
            this._maskLength = emptyMask.length;
        },

        _isPartOfMaskGroup: function(maskChar, maskIndex) {
            var that = this;
            var rules = that._rules || [];
            var key;
            var mask = that.options.mask || "";

            for (key in rules) {
                if (isString(key) && mask.substr(maskIndex, key.length) === key) {
                    return new MaskGroup({
                        maskIndex: maskIndex,
                        text: key,
                        rule: rules[key]
                    });
                }
            }

            return false;
        },

        _tokenizeMaskGroup: function(maskGroup) {
            var group = maskGroup || {};
            var groupTokens = [];
            var maskIndex = group.maskIndex || 0;
            var text = group.text || "";
            var textLength = text.length;
            var i;

            for (i = 0; i < textLength; i++) {
                groupTokens.push(new MaskToken({
                    maskIndex: maskIndex + i,
                    text: text[i],
                    group: group
                }));
            }

            return groupTokens;
        }
    });

    ui.plugin(MaskedTextBox);

    var MaskElement = Class.extend({
       init: function(options) {
            var that = this;

            that.maskIndex = options.maskIndex || 0;
            that.text = options.text || "";
            that.rule = options.rule;
        }
    });

    var MaskToken = MaskElement.extend({
        init: function(options) {
            var that = this;

            MaskElement.fn.init.call(that, options);
            that.group = options.group;
        }
    });

    var MaskGroup = MaskElement.extend({
        init: function(options) {
            MaskElement.fn.init.call(this, options);
        }
    });
})(window.kendo.jQuery);

return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });
