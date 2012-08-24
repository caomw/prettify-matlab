// ==UserScript==
// @name           StackOverflow: MATLAB highlighter
// @namespace      StackExchange_GoogleCodePrettify_MATLAB
// @description    Adds simple MATLAB syntax highlighting on StackOverflow
// @author         Amro <amroamroamro@gmail.com>
// @version        1.1
// @license        MIT License
// @icon           http://cdn.sstatic.net/stackoverflow/img/favicon.ico
// @include        http://stackoverflow.com/questions/*
// @run-at         document-end
// ==/UserScript==

(function () {
	// create and inject a <script> element into page's DOM, with func source inlined.
	// It will be executed in the page scope, not the Greasemonkey sandbox
	// REFERENCE : http://wiki.greasespot.net/Content_Script_Injection
	function script_inject(func) {
		var script = document.createElement('script');
		script.setAttribute('type', 'text/javascript');
		script.textContent = '(' + func.toString() + ')();';
		document.body.appendChild(script);		// Insert script into page, so it will run
		//document.body.removeChild(script);	// immediately remove it to clean up
	}

	// GM_addStyle
	function style_inject(css) {
		var style = document.createElement('style');
		style.setAttribute('type', 'text/css');
		style.textContent = css.toString();
		document.getElementsByTagName('head')[0].appendChild(style);
	}

	// activate only on an actual question page (ignore question lists, tag pages, and such)
	if ( !/^\/questions\/(\d+|ask)/.test(window.location.pathname) ) {
		return;
	}
	
	// insert our custom CSS styles
	style_inject([
		'@media screen {',
		'	/* plain text: #000; */',
		'	.lang-matlab .pln { color: #000000; }',
		'	/* strings: #080; #800000; */',
		'	.lang-matlab .str { color: #A020F0; }',
		'	/* keywords: #00008B; */',
		'	.lang-matlab .kwd { color: #0000FF; }',
		'	/* comments: #808080; */',
		'	.lang-matlab .com { color: #228B22; }',
		'	/* types: #606; */',
		'	.lang-matlab .typ { color: #000000; font-weight: bold; }',
		'	/* literals: #066; #000; */',
		'	.lang-matlab .lit { color: #800000; }',
		'	/* punctuation: #660; */',
		'	.lang-matlab .pun { color: #000000; }',
		'	/* tag: #008; */',
		'	.lang-matlab .tag { color: #000000; }',
		'	/* identifiers */',
		'	.lang-matlab .ident { color: #000000; }',
		'	/* special variables/constants: darkblue */',
		'	.lang-matlab .const { color: #00008B; }',
		'	/* system commands */',
		'	.lang-matlab .syscmd { color: #B28C00; }',
		'	/* code output */',
		'	.lang-matlab .codeoutput { color: #666666; }',
		'	/* error messages */',
		'	.lang-matlab .err { color: #E60000; }',
		'	/* warning messages */',
		'	.lang-matlab .wrn { color: #FF6400; }',
		'	/* transpose operator */',
		'	.lang-matlab .transpose { color: #000000; }',
		'	/* line continuation */',
		'	.lang-matlab .linecont { color: #0000FF; }',
		'	/* unterminated strings */',
		'	.lang-matlab .untermstring { color: #B20000; }',
		'}',
	].join(""));

	script_inject(function () {
		// add to onReady queue of SE (a stub for $.ready)
		StackExchange.ready(function () {
			// check if question tags contain MATLAB
			var isMATLAB = false;
			var tags = document.getElementsByClassName('post-tag');
			for (var i = 0; i < tags.length; ++i) {
				if (tags[i].textContent === 'matlab') {
					isMATLAB = true;
					break;
				}
			}
			if (!isMATLAB || !StackExchange.options.styleCode) {
				return;
			}

			// check prettify JS library is available, otherwise lazy load it
			StackExchange.using("prettify", function () {
				// register the new language handlers
				RegisterMATLABLanguageHandlers();

				// explicitly specify the lang for the whole page
				document.getElementById('prettify-lang').textContent = 'lang-matlab';
				// for each prettyprint <pre> blocks
				var blocks = document.getElementsByTagName('pre');
				for (var i = 0; i < blocks.length; ++i) {
					// look for embedded HTML5 <code> element
					if (blocks[i].className.indexOf('prettyprint') != -1 && blocks[i].children.length && blocks[i].children[0].tagName === 'CODE') {
						// remove existing formatting inside <code> tag, by setting content to plain text again
						// This was necessary on Stack Overflow to avoid "double-styling"!
						unprettify(blocks[i].children[0]);
						
						// set the language to MATLAB
						blocks[i].className = 'prettyprint lang-matlab';
					}
				}

				// reapply highlighting (calls window.prettyPrint() function)
				StackExchange.prettify.applyCodeStyling();
			});
		});

		function unprettify(codeNode) {
			var code = $(codeNode);		// <code> tag
			var encodedStr = code.html().replace(/<br[^>]*>/g, "\n").replace(/&nbsp;/g, " ");	// html encoded
			var decodedStr = $("<div/>").html(encodedStr).text();	// decode html entities
			code.text(decodedStr);		// text() replaces special characters like `<` with `&lt;`
		}
		
		function RegisterMATLABLanguageHandlers() {
			/*
				PR_PLAIN: plain text
				PR_STRING: string literals
				PR_KEYWORD: keywords
				PR_COMMENT: comments
				PR_TYPE: types
				PR_LITERAL: literal values (1, null, true, ..)
				PR_PUNCTUATION: punctuation string
				PR_SOURCE: embedded source
				PR_DECLARATION: markup declaration such as a DOCTYPE
				PR_TAG: sgml tag
				PR_ATTRIB_NAME: sgml attribute name
				PR_ATTRIB_VALUE: sgml attribute value
			*/
			var PR_IDENTIFIER = "ident",
				PR_CONSTANT = "const",
				PR_SYSCMD = "syscmd",
				PR_CODE_OUTPUT = "codeoutput",
				PR_ERROR = "err",
				PR_WARNING = "wrn",
				PR_TRANSPOSE = "transpose",
				PR_LINE_CONTINUATION = "linecont";
			
			// identifiers: variable/function name, or a chain of variable names joined by dots (obj.method, struct.field1.field2, etc..)
			// valid variable names (start with letter, and contains letters, digits, and underscores).
			// we match "xx.yy" as a whole so that if "xx" is plain and "yy" is not, we dont get a false positive for "yy"
			//var reIdent = '(?:[a-zA-Z][a-zA-Z0-9_]*)';
			//var reIdentChain = '(?:' + reIdent + '(?:\.' + reIdent + ')*' + ')';
			
			// patterns that always start with a known character. Must have a shortcut string.
			var shortcutStylePatterns = [
				// whitespaces: space, tab, carriage return, line feed, line tab, form-feed, non-break space
				[PR.PR_PLAIN, /^[ \t\r\n\v\f\xA0]+/, null, " \t\r\n\u000b\u000c\u00a0"],
			
				// block comments
				//TODO: chokes on nested block comments
				//TODO: false positives when the lines with %{ and %} contain non-spaces
				//[PR.PR_COMMENT, /^%(?:[^\{].*|\{(?:%|%*[^\}%])*(?:\}+%?)?)/, null],
				[PR.PR_COMMENT, /^%\{[^%]*%+(?:[^\}%][^%]*%+)*\}/, null],
			
				// single-line comments
				[PR.PR_COMMENT, /^%[^\r\n]*/, null, "%"],
			
				// system commands
				[PR_SYSCMD, /^![^\r\n]*/, null, "!"]
			];
			
			// patterns that will be tried in order if the shortcut ones fail. May have shortcuts.
			var fallthroughStylePatterns = [
				// line continuation
				[PR_LINE_CONTINUATION, /^\.\.\.\s*[\r\n]/, null],
			
				// error message
				[PR_ERROR, /^\?\?\? [^\r\n]*/, null],
			
				// warning message
				[PR_WARNING, /^Warning: [^\r\n]*/, null],
			
				// command prompt/output
				//[PR_CODE_OUTPUT, /^>>\s+[^\r\n]*[\r\n]{1,2}[^=]*=[^\r\n]*[\r\n]{1,2}[^\r\n]*/, null],		// full command output (both loose/compact format): `>> EXP\nVAR =\n VAL`
				[PR_CODE_OUTPUT, /^>>\s+/, null],			// only the command prompt `>> `
				[PR_CODE_OUTPUT, /^octave:\d+>\s+/, null],	// Octave command prompt `octave:1> `
			
				// identifier (chain) or closing-parenthesis/brace/bracket, and IS followed by transpose operator
				// this way we dont misdetect the transpose operator ' as the start of a string
				["lang-matlab-operators", /^((?:[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*|\)|\]|\}|\.)')/, null],
			
				// identifier (chain), and NOT followed by transpose operator
				// this must come AFTER the "is followed by transpose" step (otherwise it chops the last char of identifier)
				["lang-matlab-identifiers", /^([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)(?!')/, null],
			
				// single-quoted strings: allow for escaping with '', no multilines
				//[PR.PR_STRING, /(?:(?<=(?:\(|\[|\{|\s|=|;|,|:))|^)'(?:[^']|'')*'(?=(?:\)|\]|\}|\s|=|;|,|:|~|<|>|&|-|\+|\*|\.|\^|\|))/, null],	// string vs. transpose (check before/after context using negative/positive lookbehind/lookahead)
				[PR.PR_STRING, /^'(?:[^']|'')*'/, null],	// "'"
			
				// floating point numbers: 1, 1.0, 1i, -1.1E-1
				[PR.PR_LITERAL, /^[+\-]?\.?\d+(?:\.\d*)?(?:[Ee][+\-]?\d+)?[ij]?/, null],
			
				// parentheses, braces, brackets
				[PR.PR_TAG, /^(?:\{|\}|\(|\)|\[|\])/, null],	// "{}()[]"
			
				// other operators
				[PR.PR_PUNCTUATION, /^(?:<|>|=|~|@|&|;|,|:|!|\-|\+|\*|\^|\.|\||\\|\/)/, null]
			];
			
			var identifiersPatterns = [
				// list of keywords (`iskeyword`)
				[PR.PR_KEYWORD, /^\b(?:break|case|catch|classdef|continue|else|elseif|end|for|function|global|if|otherwise|parfor|persistent|return|spmd|switch|try|while)\b/, null],
			
				// some specials variables/constants
				[PR_CONSTANT, /^\b(?:true|false|inf|Inf|nan|NaN|eps|pi|ans|nargin|nargout|varargin|varargout)\b/, null],
			
				// some data types
				[PR.PR_TYPE, /^\b(?:cell|struct|char|double|single|logical|u?int(?:8|16|32|64)|sparse)\b/, null],
			
				// plain identifier (user-defined variable/function name)
				[PR_IDENTIFIER, /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*/, null]
			];
			
			var operatorsPatterns = [
				// forward to identifiers to match
				["lang-matlab-identifiers", /^([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)/, null],
			
				// parentheses, braces, brackets
				[PR.PR_TAG, /^(?:\{|\}|\(|\)|\[|\])/, null],	// "{}()[]"
			
				// other operators
				[PR.PR_PUNCTUATION, /^(?:<|>|=|~|@|&|;|,|:|!|\-|\+|\*|\^|\.|\||\\|\/)/, null],
			
				// transpose operators
				[PR_TRANSPOSE, /^'/, null]
			];
			
			PR.registerLangHandler(
				PR.createSimpleLexer([], identifiersPatterns),
				["matlab-identifiers"]
			);
			PR.registerLangHandler(
				PR.createSimpleLexer([], operatorsPatterns),
				["matlab-operators"]
			);
			PR.registerLangHandler(
				PR.createSimpleLexer(shortcutStylePatterns, fallthroughStylePatterns),
				["matlab"]
			);
		}
	});
})();
