'use strict';

(function () {
    var apiUrl = "../api/cases"
    var commentApiUrl = "../api/cases/comments";
    var deepLinkUrl = "../api/deeplink";
    var updateValidationTabUrlUrl = "../api/validations";
    var spinner = '<i class="fa fa-spinner fa-spin"></i>  ';
    var thumbsUp = '<i class="fa fa-thumbs-up"> </i>';
    var thumbsDown = '<i class="fa fa-thumbs-down"> </i>';

    var MSFT_TENANT_ID = "72f988bf-86f1-41af-91ab-2d7cd011db47";

    // TESTING
    //var APP_ID = "b846239c-20f9-452b-b121-8ab17c91b24e";
    //var TAB_URL_BASE = "https%3A%2F%2Fc0e3bd7d.ngrok.io%2Fvalidations%2F";

    // PRODUCTION
    var APP_ID = "28769a3c-0a17-4c2a-a118-680af5e7a8be";
    var TAB_URL_BASE = "https%3A%2F%2Ftap-validation-tab.azurewebsites.net%2Fvalidations%2F";

    var emailToTidUrl = "../api/tenants";

    var userTenantId = "";
    var userCleanEmail = "";

    const old_clients = ["windows", "mac", "android", "ios",];
    const clients = ["windows", "mac", "android", "ios", "chrome", "linux"];

    var caseClients = {};

    function getUrlVars() {
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
            vars[key] = value;
        });
        return vars;
    }

    function cleanEmail(email) {
        if (email) {
            email = email.toLowerCase();
            email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
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
        }

        return email;
    }

    // Link to a tab needs a djb2 hash of the app ID and the entity ID.
    // This isn't documented anywhere... I got it from an open-source library, source here:
    // https://github.com/ydogandjiev/microsoft-teams-deep-link/blob/master/lib/index.ts

    const deeplinkDjb2Prefix = "_djb2_msteams_prefix_";

    function djb2_hash(str) {
        let hash = 5381;

        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) + hash + str.charCodeAt(i);
        }

        return hash >>> 0; // Ensure positive number
    }

    $(document).ready(function () {
        microsoftTeams.initialize();

        scrollToSubEntity();

        var showVector = getUrlVars()["show"];
        if ((showVector != null) && (showVector != "")) {
            $('.group-panel').each(function (index) {
                if (showVector.substring(0, 1) == 0) {
                    // Option 1: Collapse the section
                    //$(this).find('.panel-collapse').removeClass("in");

                    // Option 2: Hide the section completely
                    $(this).hide();
                }

                showVector = showVector.substring(1, showVector.length);
            });
        }

        var clientsVector = getUrlVars()["clients"];
        console.log("ClientsVector is: " + clientsVector);
        

        let groupCount = $('.group-panel').length;

        // In case this tab was configured a long time ago when there were only a few clients, need to use the vector differently
        let configured_clients = clients;

        if (clientsVector) {
            if (clientsVector.length == groupCount * clients.length) {
                configured_clients = clients;
            } else if (clientsVector.length == groupCount * old_clients.length) {
                configured_clients = old_clients;
            }
            let skipped_clients = clients.filter(e => !configured_clients.includes(e));
            console.log(skipped_clients);

            // If clientsVector is all zeroes for a section, need to reveal the clients
            $('.group-panel').each(function (index) {
                let thisGroupVector = clientsVector.substring(index * configured_clients.length, (index * configured_clients.length) + configured_clients.length);
                console.log(thisGroupVector);


                if (thisGroupVector != "0".repeat(configured_clients.length)) {
                    console.log("At least one client specified");
                    $(this).find('.no-client-checkboxes').hide();
                    $(this).find('.client-checkboxes').show();
                } else {
                    console.log("Hiding all client stuff");
                    console.log($(this).find('.client-checkboxes'));
                    $(this).find('.no-client-checkboxes').show();
                    $(this).find('.client-checkboxes').hide();
                }

                for (let i = 0; i < configured_clients.length; i++) {
                    let client = configured_clients[i];
                    if (thisGroupVector[i] == "1") {
                        $(this).find('.' + client + '-group').show();
                    } else {
                        $(this).find('.' + client + '-group').hide();
                    }
                } 

                let this_group = this;

                skipped_clients.forEach(function (client) {
                    console.log("Hiding this client: " + client);
                    $(this_group).find('.' + client + '-group').hide();
                })
            })
        } else {
            console.log("No clients");
            $('.no-client-checkboxes').show();
            $('.client-checkboxes').hide();
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

        var validationId = document.querySelector('#validation-id').innerHTML;
        console.log(validationId);

        var collectDeviceFeedback = false;

        if ((validationId == "711068") || (validationId == "713637")) {
            collectDeviceFeedback = true;
            console.log("Collecting device feedback");

            $('.panel-collapse').removeClass("in");

            $('.device-select-group').show();
            $('.teams-mode').show();

            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let teamsMode;
            let device;

            let deviceFields = $('.device-select');
            deviceFields.change(function (event) {
                device = this.value;
                $('.device-select').val(this.value);
                if (device && teamsMode) {
                    console.log("Value, so enabling buttons");
                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);
                } else {
                    console.log("No value, so disabling buttons");
                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            });

            let modeField = $('#teamsMode');
            modeField.change(function (event) {
                console.log(this);
                console.log(this.value);
                teamsMode = this.value;

                if (teamsMode) {
                    $('.panel-collapse').addClass("in");
                }

                if (device && teamsMode) {
                    console.log("Value, so enabling buttons");
                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);
                } else {
                    console.log("No value, so disabling buttons");
                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            })

        } else {
            collectDeviceFeedback = false;
            $('.device-select-group').hide();
            $('.teams-mode').hide();
        }

        microsoftTeams.getContext(function (context) {
            // Template for a link to this tab
            var tabUrl = "https://teams.microsoft.com/l/entity/{APP_ID}/{ENTITY_HASH}?context=%7B%22subEntityId%22%3Anull%2C%22canvasUrl%22%3A%22{TAB_URL_BASE}{VALIDATION_ID}%26show%3D{SHOW_VECTOR}%26clients%3D{CLIENTS_VECTOR}%22%2C%22channelId%22%3A%22{CHANNEL_ID}%22%7D&groupId={GROUP_ID}&tenantId={TENANT_ID}";

            var entityId = context.entityId;
            //console.log(entityId);

            var channelId = context.channelId;
            //console.log(channelId);
            // Make it url-safe
            channelId = channelId.replace(":", "%3A");
            channelId = channelId.replace("@", "%40");

            var groupId = context.groupId;

            var tid = context.tid;

            if (tid != MSFT_TENANT_ID) {
                return;
            }

            //console.log(context);

            var entityHash = djb2_hash(APP_ID + ":" + entityId.replace(/\+/g, " "));
            //console.log(entityHash);

            tabUrl = tabUrl.replace('{APP_ID}', APP_ID);
            tabUrl = tabUrl.replace('{ENTITY_HASH}', deeplinkDjb2Prefix + entityHash);
            tabUrl = tabUrl.replace('{CHANNEL_ID}', channelId);
            tabUrl = tabUrl.replace('{TAB_URL_BASE}', TAB_URL_BASE);
            if (showVector != null) {
                tabUrl = tabUrl.replace("{SHOW_VECTOR}", showVector);
            } else {
                tabUrl = tabUrl.replace("{SHOW_VECTOR}", "");
            }
            if (clientsVector != null) {
                tabUrl = tabUrl.replace("{CLIENTS_VECTOR}", clientsVector);
            } else {
                tabUrl = tabUrl.replace("{CLIENTS_VECTOR}", "");
            }

            tabUrl = tabUrl.replace("{VALIDATION_ID}", validationId);
            tabUrl = tabUrl.replace('{GROUP_ID}', groupId);
            tabUrl = tabUrl.replace('{TENANT_ID}', tid);
            //tabUrl = encodeURI(tabUrl);
            console.log(tabUrl);

            var params = {
                tabUrl: tabUrl,
                validationId: validationId
            }
            ajaxRequest('POST', updateValidationTabUrlUrl, params, function () {
                console.log("Updated tab url");
            });

            // Get the user's tenant from their email address
            ajaxRequest('POST', emailToTidUrl, { email: context['userPrincipalName'] }, function (data) {
                let result = JSON.parse(data);
                //console.log(result.tid);
                userTenantId = result.tid;

                $('.' + userTenantId + "-tenant").hide();
                $('.' + userTenantId + "-email").show();

                // Show all results to Microsoft viewers
                console.log("Email is: " + context['userPrincipalName']);
                console.log("Email includes microsoft.com: " + context['userPrincipalName'].includes("@microsoft.com"));
                if (context['userPrincipalName'].includes("@microsoft.com")) {
                    $('.tenant').hide();
                    $('.email').show();
                }


            });
        })
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

            var deviceSelect = kase.querySelector('input.device-select');

            var teamsModeSelect = document.querySelector('#teamsMode');

            var radios = $(kase).find('button:radio');

            var upParams = {
                validationId: validationId,
                userId: "me",
                userEmail: "someone@gmail.com",
                userTenantId: "???",
                clientType: "dunno",
                upDown: "up",
                cId: cId,
                device: "",
                teamsMode: "",
            };

            var downParams = {
                validationId: validationId,
                userId: "me",
                userEmail: "someone@gmail.com",
                userTenantId: "???",
                clientType: "dunno",
                upDown: "down",
                cId: cId,
                device: "",
                teamsMode: "",

            };

            var clientParams = {
                validationId: validationId,
                userId: "me",
                userEmail: "someone@gmail.com",
                userTenantId: "???",
                clientType: "dunno",
                upDown: "up",
                cId: cId,
                device: "",
                teamsMode: "",

            };

            var voteUrl = apiUrl + '/' + cId;
            var commentUrl = commentApiUrl + '/' + cId;

            //console.log(voteUrl);

            microsoftTeams.getContext(function (context) {
                var emailForVoteLists = cleanEmail(context["userPrincipalName"]);
                //console.log(emailForVoteLists);

                upParams.userId = context["userObjectId"];
                downParams.userId = context["userObjectId"];
                clientParams.userId = context["userObjectId"];
                
                upParams.userEmail = context["userPrincipalName"];
                downParams.userEmail = context["userPrincipalName"];
                clientParams.userEmail = context["userPrincipalName"];

                upParams.userTenantId = context["tid"];
                downParams.userTenantId = context["tid"];
                clientParams.userTenantId = context["tid"];

                upParams.clientType = context["hostClientType"];
                downParams.clientType = context["hostClientType"];
                clientParams.clientType = context["hostClientType"];

                upParams.context = context;
                downParams.context = context;
                clientParams.context = context;

                var deepLinkParams = {
                    subEntityId: cId,
                    subEntityLabel: "'" + caseText.textContent + "'"
                };

                upvoteButton.addEventListener('click', function () {
                    console.log(upvoteButton.innerHTML);
                    upvoteButton.innerHTML = upvoteButton.innerHTML.replace(thumbsUp, spinner);
                    if (collectDeviceFeedback) {
                        upParams.device = deviceSelect.value;
                        upParams.teamsMode = teamsModeSelect.value;
                    }


                    ajaxRequest('POST', voteUrl, upParams, function () {
                        ajaxRequest('GET', voteUrl, {}, updateVotes);
                    });
                });

                downvoteButton.addEventListener('click', function () {
                    console.log("downvote button got clicked");
                    downvoteButton.innerHTML = downvoteButton.innerHTML.replace(thumbsDown, spinner);

                    if (collectDeviceFeedback) {
                        downParams.device = deviceSelect.value;
                        downParams.teamsMode = teamsModeSelect.value;
                    }


                    ajaxRequest('POST', voteUrl, downParams, function () {
                        ajaxRequest('GET', voteUrl, {}, updateVotes);
                    });
                });

                $(kase).find('input:radio').change(function () {
                    console.log("Clicked a radio");
                    let cId = $(this)[0].id.split("-")[0];
                    let name = $(this).attr('name');

                    console.log(cId);

                    let upDown = $(this)[0].id.split("-")[2];
                    if (upDown == "works") {
                        upDown = "up";
                    } else {
                        upDown = "down";
                    }

                    clientParams.upDown = upDown;
                    clientParams.client = name;
                    console.log(clientParams);

                    this.innerHTML = spinner + this.innerHTML;

                    ajaxRequest('POST', voteUrl, clientParams, function () {
                        ajaxRequest('GET', voteUrl, {}, updateVotes);
                    });

                })

                deepLinkButton.addEventListener('click', function () {
                    microsoftTeams.shareDeepLink(deepLinkParams);
                });

                commentButton.addEventListener('click', function () {
                    $('#comment-id').text(cId);
                })

                var clientsVector = getUrlVars()["clients"];

                // Figure out which cases the user has voted on

                if (upvoteList.innerHTML.includes(emailForVoteLists)) {
                    if (!collectDeviceFeedback) {
                        upvoteButton.disabled = true;
                    }
                    
                    //$(kase).find('.panel-collapse').collapse('hide');
                    $(kase).find('.case-text').html($(kase).find('.case-text').html() + " <span style='color: green'>(Works)</span>");
                    $(kase).find('.panel-heading').addClass('case-works');

                    if (clientsVector == null) {
                        $(kase).find('.panel-collapse').removeClass("in");
                    } else {
                        let groupCount = $('.group-panel').length;
                        let configured_clients = clients;

                        if (clientsVector.length == groupCount * clients.length) {
                            configured_clients = clients;
                        } else if (clientsVector.length == groupCount * old_clients.length) {
                            configured_clients = old_clients;
                        }

                        if (upvoteList.innerHTML.includes(emailForVoteLists + " (Windows)")) {
                            $(kase).find('#' + cId + '-windows-works').parent().addClass('active');
                        }

                        if (upvoteList.innerHTML.includes(emailForVoteLists + " (Mac)")) {
                            $(kase).find('#' + cId + '-mac-works').parent().addClass('active');
                        }

                        if (upvoteList.innerHTML.includes(emailForVoteLists + " (Android)")) {
                            $(kase).find('#' + cId + '-android-works').parent().addClass('active');
                        }

                        if (upvoteList.innerHTML.includes(emailForVoteLists + " (iOS)")) {
                            $(kase).find('#' + cId + '-ios-works').parent().addClass('active');
                        }

                        // TODO: Too lazy to deal with caps stuff right now, so copy pasting these
                        if ((upvoteList.innerHTML.includes(emailForVoteLists + " (Chrome)")) || (upvoteList.innerHTML.includes(emailForVoteLists + " (chrome)"))) {
                            $(kase).find('#' + cId + '-chrome-works').parent().addClass('active');
                        }

                        if ((upvoteList.innerHTML.includes(emailForVoteLists + " (Linux)")) || (upvoteList.innerHTML.includes(emailForVoteLists + " (linux)"))) {
                            $(kase).find('#' + cId + '-linux-works').parent().addClass('active');
                        }
                    }


                    totalVotedCount++;
                } else if (downvoteList.innerHTML.includes(emailForVoteLists)) {
                    if (!collectDeviceFeedback) {
                        downvoteButton.disabled = true;
                    }

                    $(kase).find('.case-text').html($(kase).find('.case-text').html() + " <span style='color: red'>(Fails)</span>");
                    $(kase).find('.panel-heading').addClass('case-fails');

                    if (clientsVector == null) {

                    } else {
                        let groupCount = $('.group-panel').length;
                        let configured_clients = clients;

                        if (clientsVector.length == groupCount * clients.length) {
                            configured_clients = clients;
                        } else if (clientsVector.length == groupCount * old_clients.length) {
                            configured_clients = old_clients;
                        }

                        if (downvoteList.innerHTML.includes(emailForVoteLists + " (Windows)")) {
                            $(kase).find('#' + cId + '-windows-fails').parent().addClass('active');
                        }

                        if (downvoteList.innerHTML.includes(emailForVoteLists + " (Mac)")) {
                            $(kase).find('#' + cId + '-mac-fails').parent().addClass('active');
                        }

                        if (downvoteList.innerHTML.includes(emailForVoteLists + " (Android)")) {
                            $(kase).find('#' + cId + '-android-fails').parent().addClass('active');
                        }

                        if (downvoteList.innerHTML.includes(emailForVoteLists + " (iOS)")) {
                            $(kase).find('#' + cId + '-ios-fails').parent().addClass('active');
                        }

                        if ((downvoteList.innerHTML.includes(emailForVoteLists + " (Chrome)")) || (downvoteList.innerHTML.includes(emailForVoteLists + " (chrome)"))) {
                            $(kase).find('#' + cId + '-chrome-fails').parent().addClass('active');
                        }

                        if ((downvoteList.innerHTML.includes(emailForVoteLists + " (Linux)")) || (downvoteList.innerHTML.includes(emailForVoteLists + " (linux)"))) {
                            $(kase).find('#' + cId + '-linux-fails').parent().addClass('active');
                        }
                    }

                    totalVotedCount++;
                }

                $('.group-panel').each(function () {
                    var caseCount = $(this).find('.case-panel').length;
                    var worksCount = $(this).find('.case-works').length;
                    var failsCount = $(this).find('.case-fails').length;
                    var votedCount = worksCount + failsCount;
                    //console.log(caseCount, worksCount, failsCount);
                    $(this).find('.group-progress').text("Progress: (" + votedCount + " / " + caseCount + ")");
                })

                $('.validation-progress').text("Scenarios Evaluated: (" + totalVotedCount + " / " + totalCaseCount + ")");
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
        var data = JSON.parse(data);
        console.log("Got this data: " + JSON.stringify(data, null, 4));
        console.log("It had an id of " + data._id);
        var kase = document.getElementById("panel-" + data._id);

        console.log(kase, data._id);

        var upvoteButton = kase.querySelector('button.btn-upvote');
        var downvoteButton = kase.querySelector('button.btn-downvote');

        let mobileVoteCounts = kase.querySelector('div.mobile-works-fails');

        // Reset the vote columns
        kase.querySelector("div.upvotes").innerHTML = "";
        kase.querySelector("div.downvotes").innerHTML = "";

        var clientsVector = getUrlVars()["clients"];
        kase.querySelector(".upvotes-header").innerHTML = "<p>Works (" + data.upvotes_v2.length + ")</p>";
        data.upvotes_v2.forEach(function (vote) {
            if (vote.client) {
                kase.querySelector("div.upvotes").innerHTML += "<p class='vote'><span class='tenant " + vote.tenantId + "- tenant' style='display: none'>" + vote.tenantName + "</span><span class='email " + vote.tenantId + "-email' style='display: none'>" + vote.email + " (" + vote.client + ")" + "</span></p>";
            } else if (vote.device) {
                kase.querySelector("div.upvotes").innerHTML += "<p class='vote'><span class='tenant " + vote.tenantId + "- tenant' style='display: none'>" + vote.tenantName + "</span><span class='email " + vote.tenantId + "-email' style='display: none'>" + vote.email + " (" + vote.device + " - " + vote.teamsMode + ")" + "</span></p>";
            } else {
                kase.querySelector("div.upvotes").innerHTML += "<p class='vote'><span class='tenant " + vote.tenantId + "- tenant' style='display: none'>" + vote.tenantName + "</span><span class='email " + vote.tenantId + "-email' style='display: none'>" + vote.email + "</span></p>";
            }
        });

        kase.querySelector(".downvotes-header").innerHTML = "<p>Fails (" + data.downvotes_v2.length + ")</p>";
        data.downvotes_v2.forEach(function (vote) {
            if (vote.client) {
                kase.querySelector("div.downvotes").innerHTML += "<p class='vote'><span class='tenant " + vote.tenantId + "- tenant' style='display: none'>" + vote.tenantName + "</span><span class='email " + vote.tenantId + "-email' style='display: none'>" + vote.email + " (" + vote.client + ")" + "</span></p>";
            } else if (vote.device) {
                kase.querySelector("div.downvotes").innerHTML += "<p class='vote'><span class='tenant " + vote.tenantId + "- tenant' style='display: none'>" + vote.tenantName + "</span><span class='email " + vote.tenantId + "-email' style='display: none'>" + vote.email + " (" + vote.device + " - " + vote.teamsMode + ")" + "</span></p>";
            } else {
                kase.querySelector("div.downvotes").innerHTML += "<p class='vote'><span class='tenant " + vote.tenantId + "- tenant' style='display: none'>" + vote.tenantName + "</span><span class='email " + vote.tenantId + "-email' style='display: none'>" + vote.email + "</span></p>";
            }
        });

        mobileVoteCounts.innerHTML = "<p>Works (" + data.upvotes_v2.length + ") | Fails (" + data.downvotes_v2.length + ")</p><br />";


        $('.' + userTenantId + "-tenant").hide();
        $('.' + userTenantId + "-email").show();

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

                $(kase).find('.case-text').html(originalCaseText + " <span style='color: green'>(Works)</span>");
                $(kase).find('.panel-heading').addClass('case-works');
                $(kase).find('.panel-heading').removeClass('case-fails');

                if (clientsVector == null) {
                    $(kase).find('.panel-collapse').collapse('hide');
                } 
            } else if (downvoteList.innerHTML.includes(emailForVoteLists)) {
                downvoteButton.disabled = true;
                upvoteButton.disabled = false;

                $(kase).find('.case-text').html(originalCaseText + " <span style='color: red'>(Fails)</span>");
                $(kase).find('.panel-heading').addClass('case-fails');
                $(kase).find('.panel-heading').removeClass('case-works');

            }

            var thisGroupPanel = $($(kase).parents()[2]);
            console.log(thisGroupPanel);
            var caseCount = thisGroupPanel.find('.case-panel').length;
            var worksCount = thisGroupPanel.find('.case-works').length;
            var failsCount = thisGroupPanel.find('.case-fails').length;
            var votedCount = worksCount + failsCount;
            console.log(caseCount, worksCount, failsCount);
            thisGroupPanel.find('.group-progress').text("Progress: (" + votedCount + " / " + caseCount + ")");

            var cases = document.querySelectorAll('.case-panel');
            var totalCaseCount = cases.length;
            var totalVotedCount = $('.case-works').length + $('.case-fails').length;
            $('.validation-progress').text("Scenarios Evaluated: (" + totalVotedCount + " / " + totalCaseCount + ")");

            // Show all results to Microsoft viewers
            if (context['userPrincipalName'].includes("@microsoft.com")) {
                $('.tenant').hide();
                $('.email').show();
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
})();