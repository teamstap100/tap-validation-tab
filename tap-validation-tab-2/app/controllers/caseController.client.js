'use strict';

(function () {
    microsoftTeams.initialize();

    var validationId = document.querySelector('#validation-id').innerHTML;
    console.log("validationId object is:", validationId);

    var cases = document.querySelectorAll('.case');

    //var deleteButton = document.querySelector('.btn-delete');

    // PRODUCTION
    var apiUrl = 'https://tap-validation-tab.azurewebsites.net//api/cases';

    // TESTING
    //var apiUrl = "https://cc2eb8a0.ngrok.io/api/cases";

    //var apiUrl = "../api/cases"

    var spinner = '<i class="fa fa-spinner fa-spin"></i>  ';

    cases.forEach(function (kase) {
        //var cId = kase.querySelector('p.subtle').innerHTML;
        var cId = kase.id;
        var caseText = kase.querySelector('p.case-text');
        var upvoteButton = kase.querySelector('button.btn-upvote');
        var downvoteButton = kase.querySelector('button.btn-downvote');
        var deepLinkButton = kase.querySelector('p.deep-link');

        console.log(upvoteButton);

        var upParams = {
            validationId: validationId,
            userId: "me",
            userEmail: "someone@gmail.com",
            userTenantId: "???",
            clientType: "dunno",
            upDown: "up",
            cId: cId
        };

        var downParams = {
            validationId: validationId,
            userId: "me",
            userEmail: "someone@gmail.com",
            userTenantId: "???",
            clientType: "dunno",
            upDown: "down",
            cId: cId
        };

        var voteUrl = apiUrl + '/' + cId;

        console.log(voteUrl);

        microsoftTeams.getContext(function (context) {
            upParams.userId = context["userObjectId"];
            downParams.userId = context["userObjectId"];

            upParams.userEmail = context["userPrincipalName"];
            downParams.userEmail = context["userPrincipalName"];

            upParams.userTenantId = context["tid"];
            downParams.userTenantId = context["tid"];

            upParams.clientType = context["hostClientType"];
            downParams.clientType = context["hostClientType"];

            var deepLinkParams = {
                subEntityId: cId,
                subEntityLabel: "'" + caseText.textContent + "'"
            };

            upvoteButton.addEventListener('click', function () {
                upvoteButton.innerHTML = spinner + upvoteButton.innerHTML;
                ajaxRequest('POST', voteUrl, upParams, function () {
                    ajaxRequest('GET', voteUrl, {}, updateVotes);
                });
            });

            downvoteButton.addEventListener('click', function () {
                downvoteButton.innerHTML = spinner + downvoteButton.innerHTML;
                ajaxRequest('POST', voteUrl, downParams, function () {
                    ajaxRequest('GET', voteUrl, {}, updateVotes);
                });
            });

            deepLinkButton.addEventListener('click', function () {
                microsoftTeams.shareDeepLink(deepLinkParams);
            });

        });
    });

    function ready(fn) {
        if (typeof fn !== 'function') {
            return;
        }

        if (document.readyState === 'complete') {
            return fn();
        }

        document.addEventListener('DOMContentLoaded', fn, false);
    }

    function ajaxRequest(method, url, params, callback) {
        var xmlhttp = new XMLHttpRequest();

        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                callback(xmlhttp.response);
            }
        };

        xmlhttp.open(method, url, true);
        console.log("Stringified: " + JSON.stringify(params));
        xmlhttp.setRequestHeader('Content-Type', 'application/json');
        xmlhttp.send(JSON.stringify(params));
    }

    function updateVotes(data) {
        console.log("Called updateVotes");
        console.log("Got this data: " + data);
        console.log("It had an id of " + data._id);
        var data = JSON.parse(data);
        var thisCase = document.getElementById(data._id);

        var upvoteButton = thisCase.querySelector('button.btn-upvote');
        var downvoteButton = thisCase.querySelector('button.btn-downvote')

        thisCase.querySelector("div.upvotes").innerHTML = "<p>Works (" + data.upvotes.length + "):</p><br /><p class='vote'>" + data.upvotes.join("</p><p class='vote'>");
        thisCase.querySelector("div.downvotes").innerHTML = "<p>Fails (" + data.downvotes.length + "):</p><br /><p class='vote'>" + data.downvotes.join("</p><p class='vote'>");
        upvoteButton.innerHTML = upvoteButton.innerHTML.replace(spinner, '');
        downvoteButton.innerHTML = downvoteButton.innerHTML.replace(spinner, '');
    }

    //ready(ajaxRequest('GET', apiUrl, addCaseDiv));

    function scrollToSubEntity() {
        microsoftTeams.getContext(function (context) {
            var subEntity = context['subEntityId'];
            //console.log("subentity: " + subEntity);
            if (subEntity != '') {
                var highlightedCase = document.getElementById(subEntity);
                highlightedCase.scrollIntoView({ behavior: 'smooth' });
            }

        });
    }

    ready(scrollToSubEntity);
})();