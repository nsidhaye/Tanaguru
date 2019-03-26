var resolveAppliedStyle = (function () {
    var documentElement = document.documentElement,
            matchesSelector =
            documentElement.matchesSelector ||
            documentElement.mozMatchesSelector ||
            documentElement.webkitMatchesSelector ||
            documentElement.msMatchesSelector ||
            documentElement.oMatchesSelector;

    if (!matchesSelector) {
        if (document.querySelectorAll) {
            matchesSelector = function (selector) {
                var matchingElements = this.parentNode.querySelectorAll(selector),
                        count = matchingElements.length;

                for (var i = 0; i < count; ++i) {
                    if (matchingElements[i] === this) {
                        return true;
                    }
                }
                return false;
            };
        }
        else {
            throw new Error("no browser support for selector matching");
        }
    }

    function styleImportanceByRule(rule, styleProperty) {
        if (rule.style.getPropertyPriority) {
            return rule.style.getPropertyPriority(styleProperty) === "important" ? 100000 : 0;
        }
        else {
            return 0;
        }

    }

    function styleImportanceByStyleText(styleText) {
        return styleText.match(/\s!important/gi) ? 100000 : 0;
    }

    function resolveAppliedStyle(element, style) {

        var styleSheets = document.styleSheets,
                numberOfStyleSheets = styleSheets.length,
                styleSheet,
                styleSheetIndex,
                rule,
                rules,
                numberOfRules,
                ruleIndex,
                appliedRule,
                scoredStyles = [],
                inlineStyle,
                potentiallyAppliedStyle,
                cssStyleSpecificityScore,
                styleSpecificity,
                matchesSelectorResult;

        for (styleSheetIndex = 0; styleSheetIndex < numberOfStyleSheets; ++styleSheetIndex) {
            styleSheet = styleSheets[styleSheetIndex];

            rules = styleSheet.cssRules || styleSheet.rules;

            if (!rules) {
                continue;
            }

            numberOfRules = rules.length;

            for (ruleIndex = 0; ruleIndex < numberOfRules; ++ruleIndex) {
                rule = rules[ruleIndex];
                try {
                    matchesSelectorResult = matchesSelector.call(element, rule.selectorText);
                }
                catch (err) {
                    // console.log("invalid call to matchesSelector using string '", rule.selectorText, "', error >> ",err);
                    matchesSelectorResult = false;
                }

                if (matchesSelectorResult) {
                    potentiallyAppliedStyle = rule.style[style];
                    if (potentiallyAppliedStyle !== undefined) {

                        cssStyleSpecificityScore = +(SPECIFICITY.calculate(rule.selectorText)[0]
                                .specificity
                                .replace(/,/g, ""));

                        styleSpecificity =
                                scoredStyles.length +
                                (cssStyleSpecificityScore * 10) +
                                styleImportanceByRule(rule, style);

                        scoredStyles.push({
                            "selector": rule.selectorText,
                            "specificity": styleSpecificity,
                            "style": potentiallyAppliedStyle
                        });
                    }
                }
            }
        }

        inlineStyle = element.style[style];

        if (inlineStyle) {
            scoredStyles.push({
                "selector": "! this is an inline style !",
                "specificity": 10000 + styleImportanceByStyleText(inlineStyle),
                "style": inlineStyle
            });
        }

        if (!scoredStyles.length) {
            return undefined;
        }

        scoredStyles.sort(function (a, b) {
            if (a.specificity > b.specificity) {
                return -1;
            }
            if (a.specificity < b.specificity) {
                return 1;
            }
            return 0;
        });

        return scoredStyles[0].style;
    }


    var SPECIFICITY = (function () {

        var calculate,
                calculateSingle;


        calculate = function (input) {

            var selectors,
                    selector,
                    i,
                    len,
                    results = [];


// Separate input by commas

            selectors = input.split(',');


            for (i = 0, len = selectors.length; i < len; i += 1) {

                selector = selectors[i];

                if (selector.length > 0) {

                    results.push(calculateSingle(selector));

                }

            }


            return results;

        };


// Calculate the specificity for a selector by dividing it into simple selectors and counting them

        calculateSingle = function (input) {

            var selector = input,
                    findMatch,
                    typeCount = {
                        'a': 0,
                        'b': 0,
                        'c': 0

                    },
            parts = [],
// The following regular expressions assume that selectors matching the preceding regular expressions have been removed

                    attributeRegex = /(\[[^\]]+\])/g,
                    idRegex = /(#[^\s\+>~\.\[:]+)/g,
                    classRegex = /(\.[^\s\+>~\.\[:]+)/g,
                    pseudoElementRegex = /(::[^\s\+>~\.\[:]+|:first-line|:first-letter|:before|:after)/gi,
// A regex for pseudo classes with brackets - :nth-child(), :nth-last-child(), :nth-of-type(), :nth-last-type(), :lang()

                    pseudoClassWithBracketsRegex = /(:[\w-]+\([^\)]*\))/gi,
// A regex for other pseudo classes, which don't have brackets

                    pseudoClassRegex = /(:[^\s\+>~\.\[:]+)/g,
                    elementRegex = /([^\s\+>~\.\[:]+)/g;


// Find matches for a regular expression in a string and push their details to parts

// Type is "a" for IDs, "b" for classes, attributes and pseudo-classes and "c" for elements and pseudo-elements

            findMatch = function (regex, type) {

                var matches, i, len, match, index, length;

                if (regex.test(selector)) {

                    matches = selector.match(regex);

                    for (i = 0, len = matches.length; i < len; i += 1) {

                        typeCount[type] += 1;

                        match = matches[i];

                        index = selector.indexOf(match);

                        length = match.length;

                        parts.push({
                            selector: match,
                            type: type,
                            index: index,
                            length: length

                        });

// Replace this simple selector with whitespace so it won't be counted in further simple selectors

                        selector = selector.replace(match, Array(length + 1).join(' '));

                    }

                }

            };


// Remove the negation psuedo-class (:not) but leave its argument because specificity is calculated on its argument

            (function () {

                var regex = /:not\(([^\)]*)\)/g;

                if (regex.test(selector)) {

                    selector = selector.replace(regex, '     $1 ');

                }

            }());


// Remove anything after a left brace in case a user has pasted in a rule, not just a selector

            (function () {

                var regex = /{[^]*/gm,
                        matches, i, len, match;

                if (regex.test(selector)) {

                    matches = selector.match(regex);

                    for (i = 0, len = matches.length; i < len; i += 1) {

                        match = matches[i];

                        selector = selector.replace(match, Array(match.length + 1).join(' '));

                    }

                }

            }());


// Add attribute selectors to parts collection (type b)

            findMatch(attributeRegex, 'b');


// Add ID selectors to parts collection (type a)

            findMatch(idRegex, 'a');


// Add class selectors to parts collection (type b)

            findMatch(classRegex, 'b');


// Add pseudo-element selectors to parts collection (type c)

            findMatch(pseudoElementRegex, 'c');


// Add pseudo-class selectors to parts collection (type b)

            findMatch(pseudoClassWithBracketsRegex, 'b');

            findMatch(pseudoClassRegex, 'b');


// Remove universal selector and separator characters

            selector = selector.replace(/[\*\s\+>~]/g, ' ');


// Remove any stray dots or hashes which aren't attached to words

// These may be present if the user is live-editing this selector

            selector = selector.replace(/[#\.]/g, ' ');


// The only things left should be element selectors (type c)

            findMatch(elementRegex, 'c');


// Order the parts in the order they appear in the original selector

// This is neater for external apps to deal with

            parts.sort(function (a, b) {

                return a.index - b.index;

            });


            return {
                selector: input,
                specificity: '0,' + typeCount.a.toString() + ',' + typeCount.b.toString() + ',' + typeCount.c.toString(),
                parts: parts

            };

        };


        return {
            calculate: calculate

        };
    }());
    return resolveAppliedStyle;
})();



/*
 * determine whether forbiden units ["pt", "pc", "mm", "cm" , "in"] are used or not
 */
var attrs = ["font-size", "width", "height", "min-width", "min-height", "max-width", "max-height", "left", "right", "top", "bottom",
    "background-size", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "padding", "padding-top",
    "padding-bottom", "padding-left", "padding-right", "border", "border-top", "border-bottom", "border-left", "border-right",
    "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius",
    "border-bottom-right-radius", "text-shadow"];

//attrs = ["font-size", "border"];

var forbiddenUnits = ["pt", "pc", "mm", "cm", "in"];
var styleValueUnit;

//a voir si n'est plus utilisée
function isForbiddenUnitUsed(elem) {
    var forbiddenUnitUsed = false;
    for (var i = 0; i < attrs.length; i++) {
        if (forbiddenUnitUsed) {
            break;
        }
        styleValueUnit = resolveAppliedStyle(elem, attrs[i]) || "";  //  getStyle(elem , "" +attrs[i]);
        if (styleValueUnit !== null && styleValueUnit !== "") {
            for (var j = 0; j < forbiddenUnits.length; j++) {
                if (styleValueUnit.indexOf("" + forbiddenUnits[j]) > -1) {
                    forbiddenUnitUsed = true;
                    break;
                }

            }
        }
    }
    return forbiddenUnitUsed;
}





function isForbiddenUnitUsed2(elem) {
    var forbiddenUnitUsed = false;
    for (var x = 0; x < elementWithForbiddenUnitsRoot.length; x++) {
        if (elementWithForbiddenUnitsRoot[x] === elem) {//(elementsWithForbiddenUnits.indexOf(elem) !== -1) {
            forbiddenUnitUsed = true;
        }
    }
    return forbiddenUnitUsed;
}


/*
 * determine whether authorized units [%, em, rem, vw, vh, vmin , vmax , xx-small, x-small, small, medium, large, x-large, xx-large, xsmaller, larger] are used or not
 */
var attrs = ["font-size", "width", "height", "min-width", "min-height", "max-width", "max-height", "left", "right", "top", "bottom",
    "background-size", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "padding", "padding-top", "line-height",
    "padding-bottom", "padding-left", "padding-right", "border", "border-top", "border-top-width", "border-bottom", "border-left", "border-right",
    "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius",
    "border-bottom-right-radius", "text-shadow", "outline-width", "vertical-align"];

//attrs = ["font-size", "border"];

var authorizedUnits = ["%", "em", "rem", "vw", "vh", "vmin" , "vmax" , "xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xsmaller", "larger",
						"pt", "pc", "mm", "cm", "in"]; //not to be compute twice unrelative units
var styleValueUnit;

function isAuthorizedUnitUsed(elem) {
    var authorizedUnitsUsed = false;
    for (var i = 0; i < attrs.length; i++) {
        if (authorizedUnitsUsed) {
            break;
        }
        styleValueUnit = resolveAppliedStyle(elem, attrs[i]) || "";  //  getStyle(elem , "" +attrs[i]);
        if (styleValueUnit !== null && styleValueUnit !== "") {
            for (var j = 0; j < authorizedUnits.length; j++) {
                if (styleValueUnit.indexOf("" + authorizedUnits[j]) > -1) {
                	authorizedUnitsUsed = true;
                    break;
                }

            }
        }
    }
    return authorizedUnitsUsed;
}





function isNotAuthorizedUnitUsed2(elem) {
    var authorizedUnitsUsed = false;
    for (var x = 0; x < elementsWithoutAuthorizedUnits.length; x++) {
        if (elementsWithoutAuthorizedUnits[x] === elem) {
        	authorizedUnitsUsed = true;
        }
    }
    return authorizedUnitsUsed;
}


/*
 * determine whether a node is a text node
 */
function isTextNode(elem) {
    if (isElementOfType(elem, 'input') && elem.hasAttribute('type') && (elem.getAttribute('type') === 'text')) {
        return true;
    }
    if (isElementOfType(elem, 'iframe')) {
        return false;
    }
    if (isElementOfType(elem, 'noscript')) {
        return false;
    }
    if (isElementOfType(elem, 'script')) {
        return false;
    }
    if (isElementOfType(elem, 'style')) {
        return false;
    }
    if (isElementOfType(elem, 'img') && elem.hasAttribute('alt') && (elem.getAttribute('alt').trim().length > 0)) {
        return true;
    }
    for (var i = 0; i < elem.childNodes.length; i++) {
        if (elem.childNodes[i].nodeName === "#text" &&
                elem.childNodes[i].textContent.trim().length > 0) {
            return true;
        }
    }
    return false;
}
;

/*
 * Build a unique css Path from the parent path and the current element index
 */
function buildPath(elem, parentPath, index) {
//    if (elem.id) {
//        return "#" + elem.id;
//    }
    var name = getElementName(elem);

    if (name === 'body') {
        return name;
    } else {
        name += ':eq(' + index + ')';
        return (parentPath ? parentPath + ' > ' + name : '' + name);
    }
}

/*
 * Replace comma in color string.
 */
function formatColor(color) {
    while (color.indexOf(',') > -1) {
        color = color.replace(',', ';');
    }
    return color;
}

/*
 * compute the background color of a node
 */
function getBackgroundColor(elem) {
    var bgImg = getStyle(elem, 'background-image');
    if (bgImg !== 'none') {
        while (bgImg.indexOf('"') > -1) {
            bgImg = bgImg.replace('"', '\'');
        }
        return "background-image:" + bgImg;
    }
    var bgColor = getStyle(elem, 'background-color');
    return formatColor(bgColor);
}

/*
 * compute the foreground color of a node
 */
function getForegroundColor(elem) {
    var color = getStyle(elem, 'color');
    return formatColor(color);
    ;
}

/*
 * determine whether a node is hidden
 */
function isHidden(elem) {
    var isElementHidden =
            (getStyle(elem, 'display') === 'none') ||
            (getStyle(elem, 'visibility') === 'hidden');
    if (!isElementHidden && !isElementOfType(getElementName(elem), 'html')) {
        return isHidden(elem.parentNode);
    }
    return isElementHidden;
}

/*
 * get the computed style of an element
 */
function getStyle(elem, strCssRule, pseudoSelector) {
    var style = "";
    if (elem.currentStyle) {
        style = elem.currentStyle[strCssRule];
    } else if (window.getComputedStyle) {
        style = document.defaultView.getComputedStyle(elem, pseudoSelector).
                getPropertyValue(strCssRule);
    }
    return style;
}

/*
 * get the element name
 */
function getElementName(elem) {
    return elem.tagName.toLowerCase();
}

/*
 * determine whether an element is of a given type
 */
function isElementOfType(elemName, typeName) {
    if (elemName === typeName) {
        return true;
    }
    return false;
}

function isAllowedElement(elem) {
    var tagName = getElementName(elem);
    if (isElementOfType(tagName, 'script')) {
        return false;
    }
    if (isElementOfType(tagName, 'noscript')) {
        return false;
    }
    if (isElementOfType(tagName, 'br')) {
        return false;
    }
    if (isElementOfType(tagName, 'svg')) {
        return false;
    }
    if (isElementOfType(tagName, 'head')) {
        return false;
    }
    if (isElementOfType(tagName, 'style')) {
        return false;
    }
    if (isElementOfType(tagName, 'meta')) {
        return false;
    }
    if (isElementOfType(tagName, 'link')) {
        return false;
    }
    if (isElementOfType(tagName, 'title')) {
        return false;
    }
    if (isElementOfType(tagName, 'option')) {
        return false;
    }
    return true;
}
;

/*
 * extract info from each element of the dom
 */
function extractInfo(elem, parentFgColor, parentBgColor, result, parentPath, elemIndex) {
    if (isAllowedElement(elem)) {
        var path, element = {}, bgColor, color, children, focus;
        bgColor = getBackgroundColor(elem);
        if ((bgColor === 'transparent' || bgColor === 'rgba(0; 0; 0; 0)')) {
            if (parentBgColor !== null) {
                //  console.log(parentBgColor);
                bgColor = parentBgColor;
            } else if (isElementOfType(getElementName(elem), 'body')) {
                bgColor = 'rgb(255; 255; 255)';
            }
        }
        //  console.log(bgColor);
        color = getForegroundColor(elem);
        if ((color === 'transparent' || color === 'rgba(0; 0; 0; 0)') && parentFgColor !== null) {
            color = parentFgColor;
        }

        path = buildPath(elem, parentPath, elemIndex);

        element = {};
        element.path = '\"' + path + '\"';
        element.bgColor = '\"' + bgColor + '\"';
        element.isHidden = isHidden(elem);
        element.color = '\"' + color + '\"';
        element.fontSize = getStyle(elem, 'font-size');
        // element.fontSizeNotComputed = resolveAppliedStyle(elem, 'font-size') || "";
        element.fontWeight = getStyle(elem, 'font-weight');
        element.textAlign = getStyle(elem, 'text-align');
        element.isTextNode = isTextNode(elem);
        elem.focus(); // get the focus
        focus = document.activeElement;
        if (elem === focus) {
            element.isFocusable = true;
            element.outlineColorFocus = '\"' + formatColor(getStyle(elem, 'outline-color', 'focus')) + '\"';
            element.outlineStyleFocus = '\"' + getStyle(elem, 'outline-style', 'focus') + '\"';
            element.outlineWidthFocus = getStyle(elem, 'outline-width', 'focus');
        } else {
            element.isFocusable = false;
        }
        elem.blur(); // release the focus
        // creticla area   not comuted
        element.isForbiddenUnitUsed_NotComputed = isForbiddenUnitUsed2(elem);
        element.isAuthorizedUnitUsed_NotComputed = isNotAuthorizedUnitUsed2(elem);

        result.push(element);

        children = elem.children;
        for (var i = 0; i < children.length; i++) {
            extractInfo(children[i], color, bgColor, result, path, i);
        }
    }
}
;
/*
 * Extraction of not calculculated css property 
 * 
 */

function  getAllElementsWithForbiddenUnits( ) {
//var e = new Date().getTime();
    var forbiddenUnits = ["pt", "pc", "mm", "cm", "in"];
    var propList = [];
    var elementsWithForbiddenUnits = [];
try{
	for (var h = 0; h < document.styleSheets.length; h++) {
        for (var i in document.styleSheets[h].cssRules) {
            
            var keyList = [];
            for (var j in document.styleSheets[h].cssRules[i].style) {
                if (!isNaN(j))
                    keyList.push(document.styleSheets[h].cssRules[i].style[j]); 
            }
            
            //init propList            
            for (var k in keyList) {
                for (var u in forbiddenUnits) {
                	if(document.styleSheets[h].cssRules[i].style[keyList[k]] !== undefined){                                                    
                    	var reg = new RegExp('(\\d*.*\\d*\\s*' + forbiddenUnits[u] + ')');
                        
                        if (document.styleSheets[h].cssRules[i].style[keyList[k]].match(reg) !== null) {
                            propList.push(document.styleSheets[h].cssRules[i]); 
                            break;
                        }
                    }
                }
            }
        }
    }
     } catch(e) {
                if(e.name !== "SecurityError") {
                    throw e;
                }
           }
//console.log(propList);
   // var f = new Date().getTime();
//console.log("execution : " + (f - e) + "ms")
//var elementsWithForbiddenUnits = [];
    var tmpList = []
    for (var i = 0; i < propList.length; i++) {
        if (document.querySelector(propList[i].selectorText) !== null) {
            tmpList.push(document.querySelector(propList[i].selectorText));
            for (x in tmpList) {
                if (elementsWithForbiddenUnits.indexOf(tmpList[x]) === -1) {
                    elementsWithForbiddenUnits.push(tmpList[x]);
                }

            }
            tmpList = [];
        }
    }
    
    var reg = [];
    for (var l in forbiddenUnits) {//regex
        reg.push(new RegExp('(\\w\\s*:\\s*\\d*.*\\d*' + forbiddenUnits[l] + ')'));
    }
    var tmpElemInLineStyle = document.querySelectorAll('*[style]'); //find all element with inligne style
    for (var m = 0; m < tmpElemInLineStyle.length; m++) {
        for (var z = 0; z < reg.length; z++) {
            if (tmpElemInLineStyle[m].style.cssText.match(reg[z]) !== null) {
                elementsWithForbiddenUnits.push(tmpElemInLineStyle[m]);
                break;
            }
        }
    }
    
    return elementsWithForbiddenUnits;
}




//get all not authorized elements == haven't the authorized unit
function  getAllElementsWithoutAuthorizedUnits( ) {
	
	var hasRelativeUnit = false;
	//var e = new Date().getTime();
	var authorizedUnitsDigit = ["%", "em", "rem", "vw", "vh",
									"pt", "pc", "mm", "cm", "in"]; //not to be compute twice by unrelatives units
	var authorizedUnitsAlpha = [ "vmin" , "vmax" , "xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xsmaller", "larger"];
	var propList = [];
	var elementsWithoutAuthorizedUnits = [];

	
	try{
		for (var h = 0; h < document.styleSheets.length; h++) {
	        for (var i in document.styleSheets[h].cssRules) {
	            
	            var keyList = []; //init style
	            for (var j in document.styleSheets[h].cssRules[i].style) {
	                if (!isNaN(j))
	                    keyList.push(document.styleSheets[h].cssRules[i].style[j]); 
	            }
	            
	            //init propList  - CSS SELECTION          
	            for (var k in keyList) {
	            	hasRelativeUnit = false;
	            	if(document.styleSheets[h].cssRules[i].style[keyList[k]] !== undefined){ 
		                for (var u in authorizedUnitsDigit) {

		                    var reg1 = new RegExp('(\\d*.*\\d*\\s*' + authorizedUnitsDigit[u] + ')');
	                            
		                    if (document.styleSheets[h].cssRules[i].style[keyList[k]].match(reg1) !== null) { // if digit unit
		                       	hasRelativeUnit = true;
		                       	break;
		                    }
		                }
		                if(!hasRelativeUnit){ // if always no correspondence 
			                for (var u in authorizedUnitsAlpha) {
			                		
		                        var reg2 = new RegExp('('+ authorizedUnitsAlpha[u] + ')');
		                           
			                    if (document.styleSheets[h].cssRules[i].style[keyList[k]].match(reg2) !== null) { //if alphabetic unit
			                       	hasRelativeUnit = true;
			                       	break;
				                }
			                }
		                }
		                if(!hasRelativeUnit){ // if no relative unit
	                		propList.push(document.styleSheets[h].cssRules[i]);
	                    }
	            	}
	            }
	        }
	    }
	} catch(e) {
		if(e.name !== "SecurityError") {
			throw e;
		}
	}
	//console.log(propList);
	   // var f = new Date().getTime();
	//console.log("execution : " + (f - e) + "ms")
	//var elementsWithForbiddenUnits = [];
	     
	    //CSS SELECTION - REMOVE NULL ELEMENTS
	var tmpList = [];
	for (var i = 0; i < propList.length; i++) {	    	
		if (document.querySelector(propList[i].selectorText) !== null) {
			tmpList.push(document.querySelector(propList[i].selectorText));
			for (x in tmpList) {
				if (elementsWithoutAuthorizedUnits.indexOf(tmpList[x]) === -1) {
					elementsWithoutAuthorizedUnits.push(tmpList[x]);
				}
			}
			tmpList = [];
		}
	}
	    
	try{
		//STYLE IN BODY SELECTION
		var tmpElemInLineStyle = document.querySelectorAll('*[style]'); //find all element with inligne style
		var canCheck = false;
		var str = ""; 
		
		for (var m in tmpElemInLineStyle) { 
			hasRelativeUnit = false;
			canCheck = false;
			
			if(tmpElemInLineStyle[m].style !== undefined){  
				
				//Select if the attribute in style can have a relative unit
				str = tmpElemInLineStyle[m].style.cssText.split(':');
				if(str.length > 2) { //if there is more that one attribute in style
					
					for(var i = 0; i<str.length; i++){
						if(i === 0 ){ //to check the first style's attribute 
							for(var j in attrs){ //correspondence with style's attributes which can have a relative unit 
								if(str[0] === attrs[j]){
									canCheck = true;
									break;
								}
							}
						}else if(!canCheck){ // check the other attributes
							var str2 = str[i].split('; '); // Form : "20px; width" -> "20px","width"
							
							if(str2[1] !== undefined){
								for(var j in attrs){ //correspondence with style's attributes which can have a relative unit 
									if(str2[1] === attrs[j]){
										canCheck = true;
										break;
									}
								}
							}
						}
					}
				}else{ //if there is only one attribute in style
					for(var j in attrs){	
						if(str[0] === attrs[j]){//correspondence with style's attributes which can have a relative unit 
							canCheck = true;
							break;
						}
					}					
				}
				if(canCheck){ //if one of the style's attributes is suspected to have a relative unit
					
					for (var u in authorizedUnitsDigit) {
			        	var reg1 = new RegExp('(\\w*\\s*:\\s*\\d*.*\\d*' + authorizedUnitsDigit[u] + ')');
				    	
				    	if(tmpElemInLineStyle[m].style.cssText.match(reg1) !== null){ // if digit unit
				            hasRelativeUnit = true;
				            break;
				            	                        
				        }
				    }
				    if(!hasRelativeUnit){ // if always no correspondence 
				        for (var u in authorizedUnitsAlpha) { 
			                var reg2 = new RegExp('(\\w\\s*:\\s*' + authorizedUnitsAlpha[u] + ')');
				        	
				        	if(tmpElemInLineStyle[m].style.cssText.match(reg2) !== null){ //if alphabetic unit
				                hasRelativeUnit = true;
				                break;
				            }
				        }
				    }
				    if(!hasRelativeUnit){ // if no relative unit
				    	elementsWithoutAuthorizedUnits.push(tmpElemInLineStyle[m]);
				    }
				}
			}
		}
	} catch(e) {
		if(e.name !== "SecurityError") {
			throw e;
		}
	}
	
	return elementsWithoutAuthorizedUnits;
}


//console.log(elementsWithForbiddenUnits)
//var f2 = new Date().getTime();
//console.log("execution : "+ (f2-e) +"ms")

/*
 * Get all the elements of the DOM from body,
 * extracts the textual one and store bg-color, font-size, color and font-weight.
 */
var result = [], element, rootElem, htmlElem, htmlBgColor;
rootElem = document.body;
var elementWithForbiddenUnitsRoot = [];
var elementsWithoutAuthorizedUnits = [];
var e = new Date().getTime();
if (rootElem.length !== 0) {
    htmlElem = rootElem.parentNode;
    htmlBgColor = getBackgroundColor(htmlElem);
    if ((htmlBgColor === 'transparent' || htmlBgColor === 'rgba(0; 0; 0; 0)')) {
        htmlBgColor = 'rgb(255; 255; 255)';
    }
    elementWithForbiddenUnitsRoot = getAllElementsWithForbiddenUnits();
    elementsWithoutAuthorizedUnits = getAllElementsWithoutAuthorizedUnits();
    extractInfo(rootElem, getForegroundColor(htmlElem), htmlBgColor, result, "", 0);
}
/*var f = new Date().getTime();
 console.log("Execution : "+ (f-e)  + "ms");
 console.log(result.length);*/
return result;