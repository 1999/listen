document.addEventListener("DOMContentLoaded", function () {
	chrome.runtime.sendMessage({action: "getCurrentStatus"}, function (res) {
		document.body.innerHTML = res.length + " xxx " + res;
	});
}, false);
