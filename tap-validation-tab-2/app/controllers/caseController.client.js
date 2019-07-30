'use strict';

(function () {
    var apiUrl = "../api/cases"
    var commentApiUrl = "../api/cases/comments";
    var spinner = '<i class="fa fa-spinner fa-spin"></i>  ';
    var thumbsUp = '<i class="fa fa-thumbs-up"> </i>';
    var thumbsDown = '<i class="fa fa-thumbs-down"> </i>';

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
                    $(this).find('.panel-collapse').removeClass("in");
                    //$(this).find('.panel-collapse').collapse('hide');
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

    var cases = document.querySelectorAll('.case-panel');

    var totalCaseCount = cases.length;
    var totalVotedCount = 0;


    cases.forEach(function (kase) {
        //var cId = kase.querySelector('p.subtle').innerHTML;
        var cId = kase.id.replace("panel-", "");
        var caseText = kase.querySelector('.case-text');
        var upvoteButton = kase.querySelector('button.btn-upvote');
        var downvoteButton = kase.querySelector('button.btn-downvote');
        var commentButton = kase.querySelector('button.btn-comment');
        var upvoteList = kase.querySelector('.upvotes');
        var downvoteList = kase.querySelector('.downvotes');
        
        var deepLinkButton = kase.querySelector('p.deep-link');

        //console.log(upvoteButton);

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

        //console.log(voteUrl);

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
                    console.log(upvoteButton.innerHTML);
                    upvoteButton.innerHTML = upvoteButton.innerHTML.replace(thumbsUp, spinner);
                    ajaxRequest('POST', voteUrl, upParams, function () {
                        ajaxRequest('GET', voteUrl, {}, updateVotes);
                    });
                });
            }

            if (!downvoteButton.disabled) {
                downvoteButton.addEventListener('click', function () {
                    console.log("downvote button got clicked");
                    downvoteButton.innerHTML = downvoteButton.innerHTML.replace(thumbsDown, spinner);
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
                $(kase).find('.panel-collapse').removeClass("in");
                //$(kase).find('.panel-collapse').collapse('hide');
                $(kase).find('.case-text').html($(kase).find('.case-text').html() + " <span style='color: green'>(Works)</span>");
                $(kase).find('.panel-heading').addClass('case-works');

                totalVotedCount++;
            }

            if (downvoteList.innerHTML.includes(emailForVoteLists)) {
                downvoteButton.disabled = true;

                $(kase).find('.case-text').html($(kase).find('.case-text').html() + " <span style='color: red'>(Fails)</span>");
                $(kase).find('.panel-heading').addClass('case-fails');

                totalVotedCount++;
            }

            $('.group-panel').each(function () {
                var caseCount = $(this).find('.case-panel').length;
                var worksCount = $(this).find('.case-works').length;
                var failsCount = $(this).find('.case-fails').length;
                var votedCount = worksCount + failsCount;
                console.log(caseCount, worksCount, failsCount);
                $(this).find('.group-progress').text("Progress: (" + votedCount + " / " + caseCount + ")");
            })

            $('.validation-progress').text("Scenarios Evaluated: (" + totalVotedCount + " / " + totalCaseCount + ")");
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
        var kase = document.getElementById("panel-" + data._id);

        console.log(kase, data._id);

        var upvoteButton = kase.querySelector('button.btn-upvote');
        var downvoteButton = kase.querySelector('button.btn-downvote')

        // Reset the vote columns
        kase.querySelector("div.upvotes").innerHTML = "";
        kase.querySelector("div.downvotes").innerHTML = "";


        kase.querySelector(".upvotes-header").innerHTML = "<p>Works (" + data.upvotes_v2.length + "):</p>";
        data.upvotes_v2.forEach(function (vote) {
           kase.querySelector("div.upvotes").innerHTML +=  "<p class='vote'>" + vote.email + "</p><p class='vote'>";
        });

        kase.querySelector(".downvotes-header").innerHTML = "<p>Fails (" + data.downvotes_v2.length + "):</p>";
        data.downvotes_v2.forEach(function (vote) {
            kase.querySelector("div.downvotes").innerHTML += "<p class='vote'>" + vote.email + "</p><p class='vote'>";
        });

        upvoteButton.innerHTML = upvoteButton.innerHTML.replace(spinner, thumbsUp);
        downvoteButton.innerHTML = downvoteButton.innerHTML.replace(spinner, thumbsDown);

        microsoftTeams.getContext(function (context) {
            // Figure out which cases the user has voted on
            var emailForVoteLists = cleanEmail(context["userPrincipalName"]);
            console.log(emailForVoteLists);

            var upvoteList = kase.querySelector('div.upvotes');
            var downvoteList = kase.querySelector('div.downvotes');

            var originalCaseText = $(kase).find('.case-text').html();
            originalCaseText = originalCaseText.replace('<span style="color: red">(Fails)</span>', "");
            originalCaseText = originalCaseText.replace('<span style="color: green">(Works)</span>', "");

            if (upvoteList.innerHTML.includes(emailForVoteLists)) {
                upvoteButton.disabled = true;
                downvoteButton.disabled = false;

                $(kase).find('.panel-collapse').collapse('hide');
                $(kase).find('.case-text').html(originalCaseText + " <span style='color: green'>(Works)</span>");
                $(kase).find('.panel-heading').addClass('case-works');
                $(kase).find('.panel-heading').removeClass('case-fails');
            }

            if (downvoteList.innerHTML.includes(emailForVoteLists)) {
                downvoteButton.disabled = true;
                upvoteButton.disabled = false;

                $(kase).find('.case-text').html(originalCaseText + " <span style='color: red'>(Fails)</span>");
                $(kase).find('.panel-heading').addClass('case-fails');
                $(kase).find('.panel-heading').removeClass('case-works');

            }

            // TODO: Update the group and total progress values

            var thisGroupPanel = $($(kase).parents()[2]);
            console.log(thisGroupPanel);
            var caseCount = thisGroupPanel.find('.case-panel').length;
            var worksCount = thisGroupPanel.find('.case-works').length;
            var failsCount = thisGroupPanel.find('.case-fails').length;
            var votedCount = worksCount + failsCount;
            console.log(caseCount, worksCount, failsCount);
            thisGroupPanel.find('.group-progress').text("Progress: (" + votedCount + " / " + caseCount + ")");

            var totalCaseCount = cases.length;
            var totalVotedCount = $('.case-works').length + $('.case-fails').length;
            $('.validation-progress').text("Scenarios Evaluated: (" + totalVotedCount + " / " + totalCaseCount + ")");
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