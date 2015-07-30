'use strict';

/* global require, module, window, document, API_LOCATION, API_VERSION, API_KEY */

var $ = require('jquery');
var URI = require('URIjs');
var _ = require('underscore');

var tables = require('../modules/tables');

var comparisonTemplate = require('../../templates/comparison.hbs');

var columns = [
  {
    data: 'candidate_name',
    className: 'all',
    width: '30%',
    render: function(data, type, row, meta) {
      return tables.buildEntityLink(data, '/candidate/' + row.candidate_id, 'candidate');
    }
  },
  {data: 'candidate_status_full', className: 'min-tablet'},
  tables.barCurrencyColumn({data: 'total_receipts'}),
  tables.barCurrencyColumn({data: 'total_disbursements'}),
  tables.barCurrencyColumn({data: 'cash_on_hand_end_period'}),
  {
    data: 'pdf_url',
    className: 'all',
    orderable: false,
    render: function(data, type, row, meta) {
      var anchor = document.createElement('a');
      anchor.textContent = row.document_description;
      anchor.setAttribute('href', data);
      anchor.setAttribute('target', '_blank');
      return anchor.outerHTML;
    }
  },
];

var sizeColumns = [
  {
    data: 'candidate_name',
    className: 'all',
    width: '30%',
    render: function(data, type, row, meta) {
      return tables.buildEntityLink(data, '/candidate/' + row.candidate_id, 'candidate');
    }
  },
  tables.barCurrencyColumn({data: '0'}),
  tables.barCurrencyColumn({data: '200'}),
  tables.barCurrencyColumn({data: '500'}),
  tables.barCurrencyColumn({data: '1000'}),
  tables.barCurrencyColumn({data: '2000'})
];

var typeColumns = [
  {
    data: 'candidate_name',
    className: 'all',
    render: function(data, type, row, meta) {
      return tables.buildEntityLink(data, '/candidate/' + row.candidate_id, 'candidate');
    }
  },
  tables.barCurrencyColumn({data: 'individual'}),
  tables.barCurrencyColumn({data: 'committee'}),
];

var stateColumn = {'data': 'state'};
function stateColumns(results) {
  var columns = _.map(results, function(result) {
    return tables.barCurrencyColumn({data: result.candidate_id});
  });
  return [stateColumn].concat(columns);
}

function refreshTables() {
  var $comparison = $('#comparison');
  var selected = $comparison.find('input[type="checkbox"]:checked').map(function(_, input) {
    var $input = $(input);
    return {
      candidate_id: $input.attr('data-id'),
      candidate_name: $input.attr('data-name')
    };
  });
  drawSizeTable(selected);
  drawStateTable(selected);
  drawTypeTable(selected);
}

function drawComparison(results) {
  var $comparison = $('#comparison');
  $comparison.html(comparisonTemplate(results));
  $comparison.on('change', 'input[type="checkbox"]', refreshTables);
  refreshTables();
}

function mapSize(response, primary) {
  var groups = {};
  _.each(response.results, function(result) {
    groups[result.candidate_id] = groups[result.candidate_id] || {};
    groups[result.candidate_id][result.size] = result.total;
  });
  return _.map(_.pairs(groups), function(pair) {
    return _.extend(
      pair[1], {
        candidate_id: pair[0],
        candidate_name: primary[pair[0]].candidate_name
      });
  });
}

function mapState(response, primary) {
  var groups = {};
  _.each(response.results, function(result) {
    groups[result.state] = groups[result.state] || {};
    groups[result.state][result.candidate_id] = result.total;
    groups[result.state].state_full = result.state_full;
  });
  return _.map(_.pairs(groups), function(pair) {
    return _.extend(
      pair[1], {state: pair[0]});
  });
}

function mapType(response, primary) {
  var groups = {};
  var typeMap = {
    true: 'individual',
    false: 'committee'
  };
  _.each(response.results, function(result) {
    groups[result.candidate_id] = groups[result.candidate_id] || {};
    groups[result.candidate_id][typeMap[result.individual]] = result.total;
  });
  return _.map(_.pairs(groups), function(pair) {
    return _.extend(
      pair[1], {
        candidate_id: pair[0],
        candidate_name: primary[pair[0]].candidate_name
      });
  });
}

var defaultOpts = {
  destroy: true,
  lengthChange: false,
  serverSide: false,
  searching: false,
  paging: false
};

function destroyTable($table) {
  if ($.fn.dataTable.isDataTable($table)) {
    var api = $table.DataTable();
    api.clear();
    api.destroy();
  }
}

function buildUrl(selected, path) {
  var params = URI.parseQuery(window.location.search);
  var query = {
    cycle: params.cycle,
    candidate_id: _.pluck(selected, 'candidate_id')
  };
  return URI(API_LOCATION)
    .path([API_VERSION, path].join('/'))
    .addQuery(query)
    .addQuery({per_page: 0})
    .toString();
}

function drawSizeTable(selected) {
  var $table = $('table[data-type="by-size"]');
  var primary = _.object(_.map(selected, function(result) {
    return [result.candidate_id, result];
  }));
  $.getJSON(
    buildUrl(selected, 'schedules/schedule_a/by_size/by_candidate')
  ).done(function(response) {
    var data = mapSize(response, primary);
    $table.dataTable(_.extend({
      data: data,
      columns: sizeColumns,
      order: [[1, 'desc']]
    }, defaultOpts));
    tables.barsAfterRender(null, $table.DataTable());
  });
}

function drawStateTable(selected) {
  var $table = $('table[data-type="by-state"]');
  var primary = _.object(_.map(selected, function(result) {
    return [result.candidate_id, result];
  }));
  $.getJSON(
    buildUrl(selected, 'schedules/schedule_a/by_state/by_candidate')
  ).done(function(response) {
    destroyTable($table);
    // Clear headers
    $table.find('thead').html('');
    var data = mapState(response, primary);
    $table.dataTable(_.extend({
      data: data,
      columns: stateColumns(selected),
      order: [[1, 'desc']]
    }, defaultOpts));
    tables.barsAfterRender(null, $table.DataTable());
    // Populate headers with correct text
    var headerLabels = ['State'].concat(_.pluck(selected, 'candidate_name'));
    $table.find('th').each(function(index, elm) {
      $(elm).text(headerLabels[index]);
    });
  });
}

function drawTypeTable(selected) {
  var $table = $('table[data-type="by-type"]');
  var primary = _.object(_.map(selected, function(result) {
    return [result.candidate_id, result];
  }));
  $.getJSON(
    buildUrl(selected, 'schedules/schedule_a/by_contributor_type/by_candidate')
  ).done(function(response) {
    var data = mapType(response, primary);
    $table.dataTable(_.extend({
      data: data,
      columns: typeColumns,
      order: [[1, 'desc']]
    }, defaultOpts));
    tables.barsAfterRender(null, $table.DataTable());
  });
}

$(document).ready(function() {
  var $table = $('#results');
  var query = URI.parseQuery(window.location.search);
  tables.initTable($table, null, 'elections', query, columns, tables.offsetCallbacks, {
    ordering: false,
    dom: '<"results-info meta-box results-info--top"lfrip>t',
    pagingType: 'simple',
    lengthChange: false,
    pageLength: 10
  });
  $table.on('xhr.dt', function(event, settings, json) {
    drawComparison(json.data);
  });
});
