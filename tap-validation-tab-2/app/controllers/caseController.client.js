'use strict';

(function () {
    var apiUrl = "../api/cases"
    var commentApiUrl = "../api/cases/comments";
    var feedbackApiUrl = "../api/validations/feedback";
    //var deepLinkUrl = "../api/deeplink";
    var updateValidationTabUrlUrl = "../api/validations";
    const spinner = '<i class="fa fa-spinner fa-spin"></i>  ';
    const clientSpinner = '<i class="fa fa-spinner fa-spin client-spin"></i>  ';
    var thumbsUp = '<i class="fa fa-thumbs-up"> </i>';
    var thumbsDown = '<i class="fa fa-thumbs-down"> </i>';

    var MSFT_TENANT_ID = "72f988bf-86f1-41af-91ab-2d7cd011db47";

    // TESTING
    //var APP_ID = "b846239c-20f9-452b-b121-8ab17c91b24e";
    //var TAB_URL_BASE = "https%3A%2F%2Fc0e3bd7d.ngrok.io%2Fvalidations%2F";

    // PRODUCTION
    var APP_ID = "28769a3c-0a17-4c2a-a118-680af5e7a8be";
    var TAB_URL_BASE = "https%3A%2F%2Ftap-validation-tab.azurewebsites.net%2Fvalidations%2F";

    //var userTenantId = "";
    var userCleanEmail = "";

    const old_clients = ["windows", "mac", "android", "ios",];
    const clients = ["windows", "mac", "android", "ios", "chrome", "linux"];
    const walkie_clients = ['Samsung XCP', 'Android + Wired H', 'Android + Wireless H'];

    var caseClients = {};

    const HID_ISLANDS_MODE_VALIDATION = "711068";
    const WALKIE_TALKIE_VALIDATION = "767324";

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

    function refreshGroupVoteCounts() {
        let totalCaseCount = 0;
        let totalVotedCount = 0;
        $('.group-panel').each(function () {
            var caseCount = $(this).find('.case-panel').length;
            var worksCount = $(this).find('.case-works').length;
            var failsCount = $(this).find('.case-fails').length;
            var votedCount = worksCount + failsCount;
            $(this).find('.group-progress').text("Progress: (" + votedCount + " / " + caseCount + ")");


            // TDOO: Not really sure what to do about mixed "all scenarios either work or fail" setions
            if (caseCount <= worksCount) {
                $(this).addClass("section-works");
            }

            if (caseCount <= failsCount) {
                $(this).addClass("section-fails");
            }

            totalVotedCount += worksCount + failsCount;
            totalCaseCount += caseCount;

        });

        // Now count non-grouped scenarios too
        let caseCount = $('.case-panel.ungrouped').length;
        let worksCount = $('.case-works.ungrouped').length;
        let failsCount = $('.case-fails.ungrouped').length;
        let votedCount = worksCount + failsCount;

        totalVotedCount += votedCount;
        totalCaseCount += caseCount;

        $('.validation-progress').text("Scenarios Evaluated: (" + totalVotedCount + " / " + totalCaseCount + ")");
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

        // TODO: It'd be great to just have a "config" object that stores all the different features we can have active.
        // sections, collectDeviceFeedback, windows

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

        var validationId = $('#validation-id').text();
        console.log(validationId);

        var tap = $('#tap').text();
        console.log(tap);

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
                    //console.log("Hiding all client stuff");
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
                    //console.log("Hiding this client: " + client);
                    $(this_group).find('.' + client + '-group').hide();
                })
            })
        } else {
            //console.log("No clients");
            $('.no-client-checkboxes').show();
            $('.client-checkboxes').hide();
        }

        // Walkie talkie options
        if (validationId == WALKIE_TALKIE_VALIDATION) {
            $('.no-client-checkboxes').hide();
            $('.walkie-checkboxes').show();
        }

        var commentModalButton = document.querySelector('#submitComment');
        commentModalButton.addEventListener('click', function () {
            // TODO: Get the context, to get the Team and Channel ID. Launch a modal. Clicking submit on the modal creates or contributes to a thread of that item
            //console.log("Clicked the comment submit button");
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

        var collectDeviceFeedback = false;

        //if ((validationId == HID_ISLANDS_MODE_VALIDATION) || (validationId == "713637")) {
        if (validationId == HID_ISLANDS_MODE_VALIDATION) { // HID Islands Mode only
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

        if (tap == "Windows") {
            $('#windows-build').show();

            $('.panel-collapse').removeClass("in");

            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let windowsBuildType;
            let windowsBuildVersion;

            let versionField = $('#windowsBuildVersion');
            versionField.change(function (event) {
                windowsBuildVersion = this.value;
                if (windowsBuildVersion && windowsBuildType) {
                    console.log("Value, so enabling buttons");
                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);

                    $('.panel-collapse').addClass("in");
                } else {
                    console.log("No value, so disabling buttons");
                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            });

            let buildTypeField = $('#windowsBuildType');
            buildTypeField.change(function (event) {
                console.log(this);
                console.log(this.value);
                windowsBuildType = this.value;

                if (windowsBuildVersion && windowsBuildType) {
                    console.log("Value, so enabling buttons");
                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);

                    $('.panel-collapse').addClass("in");

                } else {
                    console.log("No value, so disabling buttons");
                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            })
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

        })
        var validationId = document.querySelector('#validation-id').innerHTML;
        console.log("validationId object is:", validationId);

        var cases = document.querySelectorAll('.case-panel');

        var totalCaseCount = cases.length;
        var totalVotedCount = 0;

        var windowsBuildTypeField = $('#windowsBuildType');
        var windowsBuildVersionField = $('#windowsBuildVersion');

        cases.forEach(function (kase) {
            //var cId = kase.querySelector('p.subtle').innerHTML;
            var cId = kase.id.replace("panel-", "");
            var tag = $('#validation-tag').text();
            var caseText = kase.querySelector('.case-text');
            let caseTitle = caseText.textContent;
            var upvoteButton = kase.querySelector('button.btn-upvote');
            var downvoteButton = kase.querySelector('button.btn-downvote');

            
            var upvoteList = kase.querySelector('.upvotes');
            var downvoteList = kase.querySelector('.downvotes');

            var deepLinkButton = kase.querySelector('p.deep-link');

            var deviceSelect = kase.querySelector('input.device-select');
            var teamsModeSelect = document.querySelector('#teamsMode');

            var radios = $(kase).find('button:radio');

            var upParams = {
                validationId: validationId,
                tap: tap,
                tag: tag,
                userId: "me",
                userEmail: "someone@gmail.com",
                userTenantId: "???",
                //clientType: "dunno",
                upDown: "up",
                cId: cId,
                caseTitle: caseTitle,
                //device: "",
                //teamsMode: "",
                //windowsBuildType: "",
                //windowsBuildVersion: "",
            };

            var downParams = {
                validationId: validationId,
                tap: tap,
                tag: tag,
                userId: "me",
                userEmail: "someone@gmail.com",
                userTenantId: "???",
                //clientType: "dunno",
                upDown: "down",
                cId: cId,
                caseTitle: caseTitle,
                //device: "",
                //teamsMode: "",
                //windowsBuildType: "",
                //windowsBuildVersion: "",

            };

            var clientParams = {
                validationId: validationId,
                tap: tap,
                tag: tag,
                userId: "me",
                userEmail: "someone@gmail.com",
                userTenantId: "???",
                //clientType: "dunno",
                upDown: "up",
                cId: cId,
                caseTitle: caseTitle,
                //device: "",
                //teamsMode: "",
                //windowsBuildType: "", // Probably unnecessary
                //windowsBuildVersion: "",

            };

            var voteUrl = apiUrl + '/' + cId;
            var commentUrl = commentApiUrl + '/' + cId;

            //console.log(voteUrl);

            microsoftTeams.getContext(function (context) {
                var emailForVoteLists = cleanEmail(context["userPrincipalName"]);

                //emailForVoteLists = "example@example.com";

                upParams.userId = context["userObjectId"];
                downParams.userId = context["userObjectId"];
                clientParams.userId = context["userObjectId"];
                
                upParams.userEmail = context["userPrincipalName"];
                downParams.userEmail = context["userPrincipalName"];
                clientParams.userEmail = context["userPrincipalName"];

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

                    let that = this;
                    $(this).parent().find('.thumbContainer').html(clientSpinner);

                    ajaxRequest('POST', voteUrl, clientParams, function () {
                        //ajaxRequest('GET', voteUrl, {}, updateVotes);
                        tables.each(function () {
                            if (upDown == "up") {
                                $(that).parent().find('.thumbContainer').html(thumbsUp);
                            } else {
                                $(that).parent().find('.thumbContainer').html(thumbsDown);
                            }

                            $(this).dataTable().api().ajax.reload();
                        });
                    });

                })

                $(kase).find('button.btn-comment').click(function () {
                    console.log("Clicked it");
                    console.log("cId is: " + cId);
                    $('#comment-id').text(cId);
                });
                
                var clientsVector = getUrlVars()["clients"];

                var tables = $(kase).find('.votes-table');

                tables.each(function () {
                    let table = $(this);

                    var dtable = table.DataTable({
                        paging: false,
                        info: false,
                        searching: false,
                        ajax: {
                            url: "/api/caseVotes",
                            type: "POST",
                            contentType: "application/json",
                            data: function (d) {
                                let tableId = table.attr("id");
                                let upDown = "up";
                                if (tableId.includes("up")) {
                                    upDown = "up";
                                } else {
                                    upDown = "down";
                                }

                                return JSON.stringify({
                                    cId: cId,
                                    email: emailForVoteLists,
                                    backupEmail: context["userPrincipalName"],
                                    upDown: upDown,
                                });
                            },
                            //dataSrc: "tenants"
                            dataSrc: function (json) {
                                let tableId = table.attr("id");
                                let upDown = "up";
                                if (tableId.includes("up")) {
                                    upDown = "up";
                                } else {
                                    upDown = "down";
                                }

                                // TODO: Maybe bold this votr's email in the list?

                                if (upDown == "up") {
                                    $(kase).find(".upvotes-header").html("Works (" + json.votes.length + ") ");
                                } else {
                                    $(kase).find(".downvotes-header").html("Fails (" + json.votes.length + ") ");
                                }

                                let caseHeader = $(kase).find('.case-text');
                                //caseHeader.html(caseHeader.html().replace("(Works)", ""));
                                caseHeader.html(caseHeader.html().replace("(Fails)", ""));

                                json.votes.forEach(function (voteList) {
                                    let vote = voteList[0];
                                    if (vote.includes(emailForVoteLists)) {
                                        //console.log(vote, "is the current user");
                                        if (!collectDeviceFeedback) {
                                            if (upDown == "up") {
                                                upvoteButton.disabled = true;
                                                downvoteButton.disabled = false;
                                            } else {
                                                downvoteButton.disabled = true;
                                                upvoteButton.disabled = false;
                                            }
                                        }

                                        caseHeader = $(kase).find('.case-text');
                                        if (upDown == "up") {
                                            if (!caseHeader.html().includes("(Works)")) {
                                                caseHeader.html(caseHeader.html() + " <span style='color: green'>(Works)</span>");
                                                $(kase).find('.panel-heading').addClass('case-works');
                                            }

                                            // Works overrides fails (for stuff with multiple votes)
                                            $(kase).find('.panel-heading').removeClass("case-fails");
                                            caseHeader.html(caseHeader.html().replace("(Fails)", ""));

                                        } else {
                                            if (!caseHeader.html().includes("(Fails)")) {
                                                caseHeader.html(caseHeader.html() + " <span style='color: red'>(Fails)</span>");
                                                $(kase).find('.panel-heading').addClass('case-fails');
                                            }

                                            // Works overrides fails (for stuff with multiple votes)
                                            $(kase).find('.panel-heading').removeClass("case-works");
                                            caseHeader.html(caseHeader.html().replace("(Works)", ""));
                                        }

                                        if (((clientsVector == null) || (clientsVector == 0)) && (!collectDeviceFeedback) && (validationId != WALKIE_TALKIE_VALIDATION)) {
                                            if (upDown == "up") {
                                                //$(kase).find('.panel-collapse').removeClass("in");
                                                $(kase).find('.panel-collapse').collapse('hide');
                                            }
                                        } else {
                                            if (validationId == WALKIE_TALKIE_VALIDATION) {
                                                configured_clients = walkie_clients;
                                            } else {
                                                let groupCount = $('.group-panel').length;
                                                let configured_clients = clients;

                                                if (clientsVector.length == groupCount * clients.length) {
                                                    configured_clients = clients;
                                                } else if (clientsVector.length == groupCount * old_clients.length) {
                                                    configured_clients = old_clients;
                                                }
                                            }

                                            // Mark all previous client votes as selected
                                            configured_clients.forEach(function (client) {
                                                let safeClient = client.replace(/[^\w]/gi, '_');
                                                if (vote.toLowerCase().includes(emailForVoteLists.toLowerCase() + " (" + client.toLowerCase() + ")")) {
                                                    if (upDown == "up") {
                                                        $(kase).find('#' + cId + '-' + safeClient + '-works').parent().addClass('active');
                                                    } else {
                                                        $(kase).find('#' + cId + '-' + safeClient + '-fails').parent().addClass('active');
                                                    }
                                                }
                                            })
                                        }
                                    }
                                });

                                refreshGroupVoteCounts();

                                return json.votes;
                            },
                        },
                    });

                });

                upvoteButton.addEventListener('click', function () {
                    upvoteButton.innerHTML = upvoteButton.innerHTML.replace(thumbsUp, spinner);
                    if (collectDeviceFeedback) {
                        upParams.device = deviceSelect.value;
                        upParams.teamsMode = teamsModeSelect.value;
                    }

                    if (tap == "Windows") {
                        upParams.windowsBuildType = windowsBuildTypeField.val();
                        upParams.windowsBuildVersion = windowsBuildVersionField.val();
                    }


                    ajaxRequest('POST', voteUrl, upParams, function () {
                        //ajaxRequest('GET', voteUrl, {}, updateVotes);
                        tables.each(function () {
                            console.log(this);
                            $(this).dataTable().api().ajax.reload();
                        });
                        upvoteButton.innerHTML = upvoteButton.innerHTML.replace(spinner, thumbsUp);
                    });
                });

                if (tap == "Windows") {
                    downvoteButton.setAttribute("data-target", "#windows-report-modal");
                    downvoteButton.addEventListener('click', function () {
                        if (collectDeviceFeedback) {
                            downParams.device = deviceSelect.value;
                            downParams.teamsMode = teamsModeSelect.value;
                        }

                        downParams.windowsBuildType = windowsBuildTypeField.val();
                        downParams.windowsBuildVersion = windowsBuildVersionField.val();

                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);
                        //$('#windows-report-modal').modal.launch();

                        $('#submitWindowsReport').click(function () {
                            console.log("Clicked submitWindowsReport");
                            downParams.comment = $('#windowsReportField').val();

                            if ($('#windows-report-file').prop('files').length > 0) {
                                let fileToUpload = $('#windows-report-file').prop('files')[0];
                                console.log(fileToUpload);

                                let reader = new FileReader();
                                //reader.readAsDataURL(fileToUpload);
                                reader.readAsBinaryString(fileToUpload);

                                reader.addEventListener("load", function () {
                                    console.log(reader.result);
                                    downParams.attachmentName = fileToUpload.name;
                                    downParams.attachmentContents = reader.result;

                                    downParams.attachment = fileToUpload;

                                    ajaxRequest('POST', voteUrl, downParams, function () {
                                        //ajaxRequest('GET', voteUrl, {}, updateVotes);
                                        tables.each(function () {
                                            console.log(this);
                                            $(this).dataTable().api().ajax.reload();
                                        });
                                    });
                                });
                            } else {
                                ajaxRequest('POST', voteUrl, downParams, function () {
                                    tables.each(function () {
                                        console.log(this);
                                        $(this).dataTable().api().ajax.reload();
                                    });
                                });
                            }



                            // TODO: Also handle the case where there's no file to upload, obviously


                        });
                    });
                } else {
                    downvoteButton.addEventListener('click', function () {
                        downvoteButton.innerHTML = downvoteButton.innerHTML.replace(thumbsDown, spinner);
                        if (collectDeviceFeedback) {
                            downParams.device = deviceSelect.value;
                            downParams.teamsMode = teamsModeSelect.value;
                        }

                        ajaxRequest('POST', voteUrl, downParams, function () {
                            //ajaxRequest('GET', voteUrl, {}, updateVotes);
                            tables.each(function () {
                                console.log(this);
                                $(this).dataTable().api().ajax.reload();
                            });
                            downvoteButton.innerHTML = downvoteButton.innerHTML.replace(spinner, thumbsDown);
                        });
                    });
                }



            });
        });

        // General Feedback
        if (tap == "Windows") {
            $('.feedback').show();

            var feedbackField = $('#feedbackField');
            var submitFeedback = $('#submitFeedback');

            feedbackField.on('input', function (e) {
                if (e.target.value === '') {
                    // Textarea has no value
                    submitFeedback.attr('disabled', true);
                } else {
                    // Textarea has a value
                    submitFeedback.attr('disabled', false);
                }
            });

            submitFeedback.click(function () {
                submitFeedback.html(spinner + submitFeedback.html());
                microsoftTeams.getContext(function (context) {
                    let feedbackParams = {
                        validationId: validationId,
                        text: feedbackField.val(),
                        submitterEmail: context['userPrincipalName'],
                    };


                    ajaxRequest('POST', feedbackApiUrl, feedbackParams, function () {
                        feedbackField.val("");
                        submitFeedback.html(submitFeedback.html().replace(spinner, ""));
                        $('#feedback-alert').show();
                        console.log("Done");
                    });
                });

            });
        }

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