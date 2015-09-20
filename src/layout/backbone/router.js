/*global Backbone */
var app = app || {};

(function () {
    'use strict';

    var Router = Backbone.Router.extend({
        routes: {
            'settings': 'settings',
            'news': 'news',
            'cloud': 'cloud',
            'current': 'current',
            'search/:query': 'search',
            'search-artist/:query': 'searchArtist',
            'search-album/:query': 'searchAlbum',
            'chromium': 'chromium'
        },

        current: function AppRouter_current() {
            console.log('current', arguments);
            // Set the current filter to be used
            // app.TodoFilter = param || '';

            // Trigger a collection filter event, causing hiding/unhiding
            // of Todo view items
            // app.todos.trigger('filter');
        }
    });

    app.router = new Router;
    Backbone.history.start({pushState: false});
})();
