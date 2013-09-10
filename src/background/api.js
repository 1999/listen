APIProto = {
    stat: {
        sendEvent: function APIProto_stat_sendEvent() {
            var args = [].slice.call(arguments, 0, 4);

            chrome.runtime.sendMessage({
                action: "stat",
                method: "sendEvent",
                args: args
            });
        },

        changePermittedState: function APIProto_stat_changePermittedState(permitted) {
            chrome.runtime.sendMessage({
                action: "stat",
                method: "changePermittedState",
                args: [permitted]
            });
        },

        sendAppView: function APIProto_stat_sendAppView(viewName) {
            chrome.runtime.sendMessage({
                action: "stat",
                method: "sendAppView",
                args: [viewName]
            });
        }
    }
};
