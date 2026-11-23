/* global CONFIG */

(function() {
  'use strict';

  var searchSelector = '#local-search-input';
  var resultSelector = '#local-search-result';
  var modal = jQuery('#modalSearch');
  var $input = jQuery(searchSelector);
  var $result = jQuery(resultSelector);

  if ($input.length === 0) {
    // eslint-disable-next-line no-console
    throw Error('No element selected by the searchSelector');
  }
  if ($result.length === 0) {
    // eslint-disable-next-line no-console
    throw Error('No element selected by the resultSelector');
  }

  var dataList = null;
  var loading = false;
  var failed = false;
  var inputBound = false;
  var debounceTimer = null;

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function(ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function showLoading() {
    $result.html('<div class="m-auto text-center"><div class="spinner-border" role="status"><span class="sr-only">Loading...</span></div><br/>Loading...</div>');
  }

  function showError() {
    $result.html('<div class="m-auto text-center local-search-error" role="alert">搜索索引加载失败，请稍后重试。</div>');
  }

  // 0x01. perform local searching with the cached index
  function performSearch() {
    var content = $input.val();
    if (content.trim().length <= 0) {
      $result.html('');
      $input.removeClass('invalid').removeClass('valid');
      return;
    }
    if (!dataList) {
      if (failed) {
        showError();
      }
      return;
    }

    // 0x02. parse query to keywords list
    var resultHTML = '';
    var keywords = content.trim().toLowerCase().split(/[\s-]+/);
    $result.html('');

    dataList.forEach(function(data) {
      var isMatch = true;
      if (!data.title || data.title.trim() === '') {
        data.title = 'Untitled';
      }
      var orig_data_title = data.title.trim();
      var data_title = orig_data_title.toLowerCase();
      var orig_data_content = data.content.trim();
      var data_content = orig_data_content.toLowerCase();
      var data_url = data.url;
      var index_title = -1;
      var index_content = -1;
      var first_occur = -1;
      // Skip matching when content is included in search and content is empty
      if (CONFIG.include_content_in_search && data_content === '') {
        isMatch = false;
      } else {
        keywords.forEach(function(keyword, i) {
          index_title = data_title.indexOf(keyword);
          index_content = data_content.indexOf(keyword);

          if (index_title < 0 && index_content < 0) {
            isMatch = false;
          } else {
            if (index_content < 0) {
              index_content = 0;
            }
            if (i === 0) {
              first_occur = index_content;
            }
          }
        });
      }
      // 0x03. show search results
      if (isMatch) {
        resultHTML += '<a href=\'' + escapeHTML(data_url) + '\' class=\'list-group-item list-group-item-action font-weight-bolder search-list-title\'>' + escapeHTML(orig_data_title) + '</a>';
        if (first_occur >= 0) {
          // cut out 100 characters
          var start = first_occur - 20;
          var end = first_occur + 80;

          if (start < 0) {
            start = 0;
          }

          if (start === 0) {
            end = 100;
          }

          if (end > orig_data_content.length) {
            end = orig_data_content.length;
          }

          var match_content = escapeHTML(orig_data_content.substring(start, end));

          // 索引是纯文本，先转义再高亮，避免正文里的 <、>、& 被当作 HTML 渲染
          keywords.forEach(function(keyword) {
            var safeKeyword = escapeHTML(keyword);
            var regS = new RegExp(escapeRegExp(safeKeyword), 'gi');
            match_content = match_content.replace(regS, function() {
              return '<span class="search-word">' + safeKeyword + '</span>';
            });
          });

          resultHTML += '<p class=\'search-list-content\'>' + match_content + '...</p>';
        }
      }
    });
    if (resultHTML.indexOf('list-group-item') === -1) {
      return $input.addClass('invalid').removeClass('valid');
    }
    $input.addClass('valid').removeClass('invalid');
    $result.html(resultHTML);
  }

  // 0x04. load the index once and cache it
  function loadIndex(path, callback) {
    if (dataList) {
      callback();
      return;
    }
    if (loading) {
      return;
    }
    loading = true;
    failed = false;
    showLoading();
    jQuery.ajax({
      url: path,
      dataType: 'xml',
      timeout: 10000
    }).done(function(xmlResponse) {
      dataList = jQuery('entry', xmlResponse).map(function() {
        return {
          title: jQuery('title', this).text(),
          content: jQuery('content', this).text(),
          url: jQuery('url', this).text()
        };
      }).get();
      loading = false;
      $result.html('');
      callback();
    }).fail(function() {
      loading = false;
      failed = true;
      showError();
    });
  }

  // 0x05. bind input once, debounce the query
  function bindInput() {
    if (inputBound) {
      return;
    }
    inputBound = true;
    $input.on('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(performSearch, 200);
    });
  }

  modal.on('show.bs.modal', function() {
    bindInput();
    if (!dataList) {
      showLoading();
    }
    var path = CONFIG.search_path || '/local-search.xml';
    loadIndex(path, performSearch);
  });
  modal.on('shown.bs.modal', function() {
    $input.focus();
  });
  modal.on('hidden.bs.modal', function() {
    clearTimeout(debounceTimer);
    $input.val('').removeClass('invalid').removeClass('valid');
    $result.html('');
  });
})();
