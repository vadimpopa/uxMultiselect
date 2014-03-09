app.run(['$templateCache',
    function($templateCache) {
        // add template for search typeahead result
        $templateCache.put('ux-multiselect.html',
        	['<div class="ux-multiselect-inp" data-ng-class="{ \'ux-multiselect-focus\': focusInput}" ng-click="setFocus($event)"',
				 '<ul class="ux-multiselect-ul">',
					'<li class="ux-multiselect-li ux-multiselect-item" data-ng-repeat="item in output track by $index"',
						'data-ng-class="focusChoice[$index] ? \'ux-multiselect-chosen-focused\' : \'\'"',
						'data-ng-click="removeItem($index)">',
						'{{item[displayfield]}}',
						'<span class="ux-multiselect-remove">x</span>',
					'</li>',

					'<li class="ux-multiselect-li">',
						'<input class="ux-multiselect-type" data-ng-model="query"',
						       'placeholder="{{placeholder}}"',
						       'data-ng-style="{\'width\': inputWidth + \'px\'}"',
						       'data-ui-event="{focus: \'focus()\', blur: \'blur()\'}"',
						       'data-ng-keydown="keyParser($event)"/>',
					'</li>',
					'<li class="ux-multiselect-li ux-multiselect-loader" data-ng-show="showLoader"></li>',
					'<li class="ux-multiselect-li clearfix"></li>',
				'</ul>',
			'</div>',

			'<div class="ux-multiselect-selector" data-ng-show="isOpen()"',
				'<ul class="ux-multiselect-ul">',
					'<li class="ux-multiselect-selector-li" data-ng-repeat="item in matches | limitTo: limitFilter"',
					    'data-ng-class="$parent.selectorPosition === $index ? \'ux-multiselect-choice-selected\' : \'\'"',
					    'data-ng-click="addItem(item)"',
						'data-ng-mouseenter="$parent.selectorPosition = $index">',
						'<span data-ng-bind-html="\'{{item[displayfield]}}\' | uxMultiselectHighlight: query"></span>',
					'</li>',
				'</ul>',
				'<div class="ux-multiselect-selector-more" data-ng-show="matches.length >= limitFilter">•••</div>',
			'</div>'].join(''));
}]);

app.directive('uxMultiselect', ['$templateCache','$document', '$q', '$timeout', function ($templateCache, $document, $q, $timeout) {
	return {
		templateUrl: 'ux-multiselect.html',
		scope: {
			source: '=source',
			output: '=output',
			displayfield: '=displayfield'
		},
		link: function (scope, element, attrs) {
			scope.query = "";
			scope.matches = [];
			scope.limitFilter = attrs.limitFilter; // limits # of items shown in selector
			scope.displayfield = attrs.displayfield;
			scope.focusChoice = []; // clears focus on any chosen item for del
			scope.showLoader = false;

			var isOnDocClickAttached = false,
     			timeoutPromise,
     			waitTime = 600,
     			inpEl = element.find("input");

			scope.placeholder = attrs.placeholder ? attrs.placeholder : '';


			function filterNotSelected(item){
				var i = 0,
					output = scope.output,
					ln = output.length,
					displayField = scope.displayfield,
					itemDisplayField = item[displayField];

				if(!itemDisplayField.match(new RegExp(scope.query,"gi"))){
					return false;
				}

				for(;i < ln; i++){
					if(itemDisplayField === output[i][displayField]) {
						return false;
					}
				}
				return true;
			};

			var resetMatches = function resetMatches() {
		   		scope.query = '';
		   		scope.matches.length = 0;
		   		this.showLoader = false;

	   			if (timeoutPromise) {
	              $timeout.cancel(timeoutPromise);//cancel previous timeout
	            }
			};

			var getMatchesAsync = function getMatchesAsync(query) {
				var source = scope.source;

				if(angular.isFunction(source)) {
					scope.showLoader = true;

					source(query,scope.limitFilter).then(function(matches) {
						if(this.query) {
							this.matches = matches.filter(filterNotSelected);
						}

						this.showLoader = false;
					}.bind(scope));

				} else {
					scope.matches = source.filter(filterNotSelected);
				}
			};

			scope.setFocus = function(event){
				if(inpEl[0].className !== event.target.className) {
					event.stopPropagation();

					$timeout(function(){
						inpEl[0].focus();
					},20);
				}
			};

			scope.$watch('query', function (inputValue) {

				var length = inputValue.length > 0 ? inputValue.length : scope.placeholder.length;

				scope.inputWidth = 10 + length * 6;

				if(inputValue) {
		          if (waitTime > 0) {
		            if (timeoutPromise) {
		              $timeout.cancel(timeoutPromise); //cancel previous timeout
		            }
		            timeoutPromise = $timeout(function () {
		              getMatchesAsync(inputValue);
		            }, waitTime);
		          } else {
		            getMatchesAsync(inputValue);
		          }
				}else {
					resetMatches();
				}

			}); // expand input box width based on content

			scope.addItem = function addItem(item) {
				scope.output.push(item);
				resetMatches();
			};
			scope.removeItem = function removeItem(position) {
				scope.output.splice(position, 1); // splice @ exact location

				if(scope.output.length === 0) {
					resetMatches();
				}
			};

			scope.focus = function focus() {
				scope.focusInput = true;
				scope.selectorPosition = 0; // start @ first item
			};

			scope.blur = function blur() {
				scope.focusInput = false;
			};


			scope.isOpen = function isOpen() {
				var hasMatches = scope.matches.length > 0;

				if(hasMatches && !isOnDocClickAttached) {
					isOnDocClickAttached = true;
					$document.bind('click',resetMatches);
				} else if(! hasMatches && isOnDocClickAttached) {
					isOnDocClickAttached = false;
					$document.unbind('click',resetMatches);
				}
                
                return hasMatches;
            };

			scope.keyParser = function keyParser($event) {
				var scope = this,
					key,
					atTop,
					atBottom,
					choiceFocused,
					filteredDataExists,
					queryIsEmpty = scope.query.length === 0,
					keys = {
						38: 'up',
						40: 'down',
						8 : 'backspace',
						13: 'enter',
						9 : 'tab',
						27: 'esc'
					};

				key = keys[$event.keyCode];

				if (!key || (key === 'backspace' && !queryIsEmpty)) {
					// backspace should work when query isn't empty
					scope.selectorPosition = 0;
				} else {
					atTop = scope.selectorPosition === 0;
					atBottom = scope.selectorPosition === scope.matches.length - 1;
					choiceFocused = scope.focusChoice[scope.output.length - 1] === true;
					filteredDataExists = scope.matches.length > 0;

					if (key === 'up') {
						if (atTop || !scope.selectorPosition) {
							scope.selectorPosition = scope.matches.length - 1;
						} else {
							scope.selectorPosition--;
						}
					} else if (key === 'down') {
						scope.selectorPosition = atBottom ? 0 : scope.selectorPosition + 1;
					} else if (key === 'backspace') {
						if (choiceFocused) {
							scope.removeItem(scope.output.length - 1);
							scope.focusChoice = [];
						} else {
							scope.focusChoice[scope.output.length - 1] = true;
						}
					} else if ((key === 'enter' || key === 'tab') && filteredDataExists) {
						scope.addItem(scope.matches[scope.selectorPosition], scope.output.length);
					} else if (key === 'esc' && !!scope.focusChoice) {
						scope.focusChoice = [];
						resetMatches();
					}

					$event.preventDefault();
				}
			}.bind(scope);
		}
	}
}]).filter('uxMultiselectHighlight',['$sce',function ($sce) {
	return function (text, query) {
		var html;
		if (query.length > 0 || angular.isNumber(query)) {
			text = text.toString(); 
			query = query.toString();
			html = text.replace(new RegExp(query, 'gi'), '<strong>$&</strong>');
		} else {
			html = text;	
		} 

		return $sce.trustAsHtml(html);
	};
}]);