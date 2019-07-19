'use strict';

(function () {
    var apiUrl = "../api/cases"
    var commentApiUrl = "../api/cases/comments";
    var spinner = '<i class="fa fa-spinner fa-spin"></i>  ';

    function getUrlVars() {
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
            vars[key] = value;
        });
        return vars;
    }

    function cleanEmail(email) {
        email = email.replace("#EXT#@microsoft.onmicrosoft.com", "");
        if (email.includes("@")) {
            return email;

        } else if (email.includes("_")) {
            console.log("Going the underscore route");
            var underscoreParts = email.split("_");
            var domain = underscoreParts.pop();
            var tenantString = domain.split(".")[0];

            if (underscoreParts.length > 1) {
                email = underscoreParts.join("_") + "@" + domain;
            } else {
                email = underscoreParts[0] + "@" + domain;
            }
        }
        return email;
    }

    $(document).ready(function () {
        microsoftTeams.initialize();

        console.log(getUrlVars()["show"]);
        var showVector = getUrlVars()["show"];
        if (showVector != null) {
            $('.group-panel').each(function (index) {
                if (showVector.substring(0, 1) == 0) {
                    $(this).find('.panel-collapse').collapse('hide');
                }

                showVector = showVector.substring(1, showVector.length);
            });
        }

        var commentModalButton = document.querySelector('#submitComment');
        commentModalButton.addEventListener('click', function () {
            // TODO: Get the context, to get the Team and Channel ID. Launch a modal. Clicking submit on the modal creates or contributes to a thread of that item
            console.log("Clicked the comment submit button");
            var cId = $('#comment-id').text();
            var addCommentUrl = "../api/comments";
            console.log(addCommentUrl);
            microsoftTeams.getContext(function (context) {
                var params = {
                    cId: cId,
                    comment: $('#commentField').val(),
                    userEmail: context["userPrincipalName"],
                    tId: context["tid"]
                }
                ajaxRequest('POST', addCommentUrl, params, function () {
                    console.log("Submitted");
                    $('#commentField').val("");

                });
            })


        });
    });

    var validationId = document.querySelector('#validation-id').innerHTML;
    console.log("validationId object is:", validationId);

    var cases = document.querySelectorAll('.case');



    cases.forEach(function (kase) {
        //var cId = kase.querySelector('p.subtle').innerHTML;
        var cId = kase.id;
        var caseText = kase.querySelector('.case-text');
        var upvoteButton = kase.querySelector('button.btn-upvote');
        var downvoteButton = kase.querySelector('button.btn-downvote');
        var commentButton = kase.querySelector('button.btn-comment');
        var upvoteList = kase.querySelector('.upvotes');
        var downvoteList = kase.querySelector('.downvotes');
        
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
        var commentUrl = commentApiUrl + '/' + cId;

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

            if (!upvoteButton.disabled) {
                upvoteButton.addEventListener('click', function () {
                    upvoteButton.innerHTML = spinner + upvoteButton.innerHTML;
                    ajaxRequest('POST', voteUrl, upParams, function () {
                        ajaxRequest('GET', voteUrl, {}, updateVotes);
                    });
                });
            }

            if (!downvoteButton.disabled) {
                downvoteButton.addEventListener('click', function () {
                    console.log("downvote button got clicked");
                    downvoteButton.innerHTML = spinner + downvoteButton.innerHTML;
                    ajaxRequest('POST', voteUrl, downParams, function () {
                        ajaxRequest('GET', voteUrl, {}, updateVotes);
                    });
                });
            }

            deepLinkButton.addEventListener('click', function () {
                microsoftTeams.shareDeepLink(deepLinkParams);
            });

            commentButton.addEventListener('click', function () {
                $('#comment-id').text(cId);
            })

            // Figure out which cases the user has voted on
            var emailForVoteLists = cleanEmail(context["userPrincipalName"]);
            console.log(emailForVoteLists);

            if (upvoteList.innerHTML.includes(emailForVoteLists)) {
                upvoteButton.disabled = true;
            }

            if (downvoteList.innerHTML.includes(emailForVoteLists)) {
                downvoteButton.disabled = true;
            }
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
        var data = JSON.parse(data);
        console.log("Got this data: " + JSON.stringify(data, null, 4));
        console.log("It had an id of " + data._id);
        var thisCase = document.getElementById(data._id);

        var upvoteButton = thisCase.querySelector('button.btn-upvote');
        var downvoteButton = thisCase.querySelector('button.btn-downvote')


        thisCase.querySelector("div.upvotes").innerHTML = "<p>Works (" + data.upvotes_v2.length + "):</p><p class='vote'>";
        data.upvotes_v2.forEach(function (vote) {
           thisCase.querySelector("div.upvotes").innerHTML +=  "<p class='vote'>" + vote.email + "</p><p class='vote'>";
        });

        thisCase.querySelector("div.downvotes").innerHTML = "<p>Fails (" + data.downvotes_v2.length + "):</p>";
        data.downvotes_v2.forEach(function (vote) {
            thisCase.querySelector("div.downvotes").innerHTML += "<p class='vote'>" + vote.email + "</p><p class='vote'>";
        });

        upvoteButton.innerHTML = upvoteButton.innerHTML.replace(spinner, '');
        downvoteButton.innerHTML = downvoteButton.innerHTML.replace(spinner, '');

        microsoftTeams.getContext(function (context) {
            // Figure out which cases the user has voted on
            var emailForVoteLists = cleanEmail(context["userPrincipalName"]);
            console.log(emailForVoteLists);

            var upvoteList = thisCase.querySelector('div.upvotes');
            var downvoteList = thisCase.querySelector('div.downvotes');

            if (upvoteList.innerHTML.includes(emailForVoteLists)) {
                upvoteButton.disabled = true;
                downvoteButton.disabled = false;
            }

            if (downvoteList.innerHTML.includes(emailForVoteLists)) {
                downvoteButton.disabled = true;
                upvoteButton.disabled = false;
            }
        })
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