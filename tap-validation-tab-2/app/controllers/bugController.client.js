'use strict';

(function () {
    microsoftTeams.initialize();

    var validationId = document.querySelector('#validation-id');

    var bugs = document.querySelectorAll('.bug');
    //var upvoteButtons = document.querySelectorAll('.btn-upvote');
    //var downvoteButtons = document.querySelectorAll('.btn-downvote');

    //var deleteButton = document.querySelector('.btn-delete');
    var bugList = document.querySelector('.bugList');
    var apiUrl = 'https://tap-validation-tab.azurewebsites.net//api/bugs';

    var spinner = '<i class="fa fa-spinner fa-spin"></i>  ';

    bugs.forEach(function (bug) {
        //var bId = bug.querySelector('p.subtle').innerHTML;
        var bId = bug.id;
        var bugText = bug.querySelector('p.bug-text');
        var upvoteButton = bug.querySelector('button.btn-upvote');
        var downvoteButton = bug.querySelector('button.btn-downvote');
        var deepLinkButton = bug.querySelector('p.deep-link');

        console.log(upvoteButton);

        var upParams = {
            userId: "me",
            userEmail: "someone@gmail.com",
            userTenantId: "something",
            clientType: "dunno",
            upDown: "up",
            bId: bId
        };

        var downParams = {
            userId: "me",
            userEmail: "someone@gmail.com",
            userTenantId: "something",
            clientType: "dunno",
            upDown: "down",
            bId: bId
        };

        var voteUrl = apiUrl + '/' + bId;

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
                subEntityId: bId,
                subEntityLabel: "'" + bugText.textContent + "'"
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
        var data = JSON.parse(data);
        var thisBug = document.getElementById(data._id);
        //var votesText = thisBug.querySelector("p.votes").innerText;

        var upvoteButton = thisBug.querySelector('button.btn-upvote');
        var downvoteButton = thisBug.querySelector('button.btn-downvote')

        //thisBug.querySelector("p.votes").innerText = data.upvotes.length + " repros, " + data.downvotes.length + " no-repros";
        thisBug.querySelector("div.upvotes").innerHTML = "<p>Repros (" + data.upvotes.length + "):</p><br /><p class='vote'>" + data.upvotes.join("</p><p class='vote'>");
        thisBug.querySelector("div.downvotes").innerHTML = "<p>No-repros (" + data.downvotes.length + "):</p><br /><p class='vote'>" + data.downvotes.join("</p><p class='vote'>");
        upvoteButton.innerHTML = upvoteButton.innerHTML.replace(spinner, '');
        downvoteButton.innerHTML = downvoteButton.innerHTML.replace(spinner, '');
    }

    //ready(ajaxRequest('GET', apiUrl, addBugDiv));

    function scrollToSubEntity() {
        microsoftTeams.getContext(function (context) {
            var subEntity = context['subEntityId'];
            //console.log("subentity: " + subEntity);
            if (subEntity != '') {
                var highlightedBug = document.getElementById(subEntity);
                highlightedBug.scrollIntoView({ behavior: 'smooth' });
            }

        });
    }

    ready(scrollToSubEntity);
})();