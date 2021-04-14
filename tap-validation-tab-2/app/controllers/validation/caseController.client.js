'use strict';

var config = {};

(function () {
    
    var apiUrl = "../api/cases"
    var commentApiUrl = "../api/cases/comments";
    
    var updateValidationTabUrlEndpoint = "../api/tabLocations";

    const MSFT_TENANT_ID = "72f988bf-86f1-41af-91ab-2d7cd011db47";

    var userPrefs = {};

    // PRODUCTION
    var APP_ID = "28769a3c-0a17-4c2a-a118-680af5e7a8be";
    var TAB_URL_BASE = "https%3A%2F%2Ftap-validation-tab.azurewebsites.net%2Fvalidations%2F";

    var userCleanEmail = "";

    const old_clients = ["windows", "mac", "android", "ios",];
    const clients = ["windows", "mac", "android", "ios", "web", "linux"];
    const walkie_clients = ['Samsung XCP', 'Android + Wired H', 'Android + Wireless H'];

    var caseClients = {};

    const HID_ISLANDS_MODE_VALIDATION = "711068";
    const WALKIE_TALKIE_VALIDATION = "767324";
    const WALKIE_TALKIE_VALIDATION_2 = "938428";
    const ARM_VALIDATION = "1101236";
    const SHARED_DEVICES_VALIDATION = "1412420";

    function showScenariosIfWindowsInfoFilled() {
        let windowsBuildVersion = $('#windowsBuildVersion').val();
        let windowsBuildType = $('#windowsBuildType').val();
        if (windowsBuildVersion && windowsBuildType) {
            $('.btn-upvote').attr('disabled', false);
            $('.btn-downvote').attr('disabled', false);
            $('.btn-comment').attr('disabled', false);

            $('.group-collapse').collapse("show");
            $('.case-collapse').collapse("show");

        } else {
            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);
        }
    }

    function refreshGroupVoteCounts() {
        let totalCaseCount = 0;
        let totalVotedCount = 0;
        $('.group-panel').each(function () {
            var caseCount = $(this).find('.case-panel:visible').length;
            var worksCount = $(this).find('.case-works:visible').length;
            var failsCount = $(this).find('.case-fails:visible').length;
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
        let caseCount = $('.case-panel.ungrouped:visible').length;
        let worksCount = $('.case-works.ungrouped:visible').length;
        let failsCount = $('.case-fails.ungrouped:visible').length;
        let votedCount = worksCount + failsCount;

        totalVotedCount += votedCount;
        totalCaseCount += caseCount;

        let percentComplete = (totalVotedCount / totalCaseCount) * 100;

        $('.validation-progress').text("Scenarios validated: (" + totalVotedCount + " / " + totalCaseCount + ")");
        $('#scenario-progress-bar').css("width", percentComplete + "%");
        $('#scenario-progress-bar').attr("aria-valuenow", percentComplete);
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


    function resetWindowsReport() {
        // Basic cleanup after submitting or closing Windows 'fails' report
        $('#windows-report-description-field').val("");
        $('#windows-report-file').val("");

    }

    // This gets run after the report table refreshes
    function bindEditButtons() {
        let prop = "comment";
        $('.edit-vote-' + prop).click(function () {
            let voteId = parseInt(this.id.replace("edit-vote-" + prop + "-", ""));
            let textField = $('#vote-' + prop + '-' + voteId);
            let original = textField.html().replace(/\r?\n/g, '<br>');
            textField.attr("contenteditable", "plaintext-only");

            textField.on('keydown', function (e) {
                if (e.keyCode == 13) {
                    fixLineBreak();

                    e.preventDefault();
                }
            });

            textField.css("background-color", "white");
            textField.focus();

            // When navigating away from it, save the changes to the text
            textField.off();
            textField.blur(function () {
                let textInput = textField.html().replace(/\r?\n/g, '<br>');
                textField.html(textInput);

                if (textInput != original) {
                    let url = '/api/votes/' + voteId;
                    let params = {
                        submitterEmail: context['loginHint'],
                    };

                    params[prop] = textInput;

                    ajaxRequest('PUT', url, params, function (resp) {
                        console.log("Done");
                    });
                } else {
                    console.log("Not different");
                }
                textField.attr('contenteditable', false);
                textField.css("background-color", '');
            });
        });


        /*
        $('.vote-public-checkbox').change(function () {
            console.log(this);
            let voteId = parseInt(this.id.replace("vote-public-", ""));
            console.log(voteId, this.checked);
            let url = '/api/votes/' + voteId;
            let params = {
                public: this.checked,
                submitterEmail: context['loginHint'],
            };

            if (this.checked) {
                $('#panel-' + voteId).show();
            } else {
                $('#panel-' + voteId).hide();

            }

            ajaxRequest('PUT', url, params, function (err, resp, body) {
                console.log(resp);
                console.log("Done");
            })
        });
        */
    }

    $(document).ready(function () {
        microsoftTeams.initialize();

        // TODO: Nothing really has a subentity set, so removing this
        //scrollToSubEntity();

        if (!$.fn.modal) {
            //document.write('<script src="/js/bootstrap.min.js"></script>');
            console.log("Using fallback CSS");
            document.write('<link rel="stylesheet" href="/public/css/bootstrap.min.css">');
        }

        config.showVector = getUrlVars()["show"];
        if ((config.showVector != null) && (config.showVector != "")) {
            $('.group-panel').each(function (index) {
                if (config.showVector.substring(0, 1) == 0) {
                    // Option 1: Collapse the section
                    //$(this).find('.panel-collapse').removeClass("in");

                    // Option 2: Hide the section completely
                    $(this).hide();
                }

                config.showVector = config.showVector.substring(1, config.showVector.length);
            });
        }

        console.log(getUrlVars());

        config.clientsVector = getUrlVars()["clients"];
        console.log("config.clientsVector is: " + config.clientsVector);

        config.collectWindowsInfo = $('#collectWindowsInfo').text() == "true"

        let groupCount = $('.group-panel').length;

        // In case this tab was configured a long time ago when there were only a few clients, need to use the vector differently
        let configured_clients = clients;

        config.validationId = $('#validation-id').text();

        config.tap = $('#tap').text();
        config.tag = $('#validation-tag').text();

        if (config.clientsVector) {
            if (config.clientsVector.length == groupCount * clients.length) {
                configured_clients = clients;
            } else if (config.clientsVector.length == groupCount * old_clients.length) {
                configured_clients = old_clients;
            }
            let skipped_clients = clients.filter(e => !configured_clients.includes(e));

            // If config.clientsVector is all zeroes for a section, need to reveal the clients
            $('.group-panel').each(function (index) {
                let thisGroupVector = config.clientsVector.substring(index * configured_clients.length, (index * configured_clients.length) + configured_clients.length);


                if (thisGroupVector != "0".repeat(configured_clients.length)) {
                    $(this).find('.no-client-checkboxes').hide();
                    $(this).find('.client-checkboxes').show();
                } else {
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
                    $(this_group).find('.' + client + '-group').hide();
                })
            })
        } else {
            $('.no-client-checkboxes').show();
            $('.client-checkboxes').hide();
        }

        // Walkie talkie options
        if (config.validationId == WALKIE_TALKIE_VALIDATION) {
            $('.no-client-checkboxes').hide();
            $('.walkie-checkboxes').show();
        }

        var commentModalButton = document.querySelector('#submitComment');
        commentModalButton.addEventListener('click', function () {
            // TODO: Get the context, to get the Team and Channel ID. Launch a modal. Clicking submit on the modal creates or contributes to a thread of that item
            var cId = $('#comment-id').text();
            var caseTitle = $('#comment-caseTitle').text();
            var addCommentUrl = "../api/comments";

            microsoftTeams.getContext(function (context) {
                var params = {
                    cId: cId,
                    comment: $('#commentField').val(),
                    userEmail: context["loginHint"],
                    //tId: context["tid"],
                    tap: config.tap,
                    tag: config.tag,
                    caseTitle: caseTitle,
                }

                if (config.collectDeviceFeedback) {
                    var deviceSelect = document.querySelector('#deviceSelect');

                    if (config.collectHeadsetFeedback) {
                        var headsetSelect = document.querySelector('#walkieHeadset');
                        params.headset = headsetSelect.value;
                    }

                    params.device = deviceSelect.value;

                    if (cId == "956385") {
                        // networkScenarios = a list of the names of all checked boxes in network-scenarios
                        let networkScenarios = $('input[type="checkbox"][name="network-scenarios"]:checked').map(function () { return this.value; }).get()
                        params.networkScenarios = networkScenarios;
                    } 
                }

                ajaxRequest('POST', addCommentUrl, params, function () {
                    console.log("Submitted");
                    $('#commentField').val("");

                });
            })


        });

        config.collectDeviceFeedback = false;
        config.collectHeadsetFeedback = false;

        if ((config.validationId == ARM_VALIDATION) || (config.validationId == SHARED_DEVICES_VALIDATION)) {
            config.collectDeviceFeedback = true;

            $('.panel-collapse').removeClass("in");

            $('.device-select-group').show();
            $('.teams-mode').show();

            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let device;

            let deviceField = $('#deviceSelect');

            deviceField.change(function (event) {
                device = this.value;

                if (device) {
                    $('.panel-collapse').collapse("show");

                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);

                    refreshGroupVoteCounts()
                } else {
                    $('.panel-collapse').collapse("hide");

                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            });
        } else if ((config.validationId == HID_ISLANDS_MODE_VALIDATION) || (config.validationId == WALKIE_TALKIE_VALIDATION_2)) {
            config.collectDeviceFeedback = true;
            config.collectHeadsetFeedback = true;

            $('.panel-collapse').removeClass("in");

            $('.device-select-group').show();
            $('.teams-mode').show();

            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let device;
            let headset;

            let deviceField = $('#deviceSelect');
            let headsetField = $('#walkieHeadset');
            deviceField.change(function (event) {
                device = this.value;


                if (device && headset) {
                    $('.panel-collapse').collapse("show");

                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);

                    refreshGroupVoteCounts()
                } else {
                    $('.panel-collapse').collapse("hide");

                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            });

            headsetField.change(function (event) {
                headset = this.value;


                if (device && headset) {
                    $('.panel-collapse').collapse("show");

                    $('.btn-upvote').attr('disabled', false);
                    $('.btn-downvote').attr('disabled', false);
                    $('.btn-comment').attr('disabled', false);

                    refreshGroupVoteCounts()
                } else {
                    $('.panel-collapse').collapse("hide");

                    $('.btn-upvote').attr('disabled', true);
                    $('.btn-downvote').attr('disabled', true);
                    $('.btn-comment').attr('disabled', true);
                }
            });

            /*
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
                    $('.panel-collapse').collapse("hide");
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
            */

        } else {
            config.collectDeviceFeedback = false;
            config.collectHeadsetFeedback = false;
            $('.device-select-group').hide();
            $('.teams-mode').hide();
        }

        if ((config.tap == "Windows") && (config.collectWindowsInfo)) {
            $('#windows-build').show();

            $('.panel-collapse').collapse("show");

            // TODO: The button-enabling/disabling logic overrides each other. Need to rethink it
            $('.btn-upvote').attr('disabled', true);
            $('.btn-downvote').attr('disabled', true);
            $('.btn-comment').attr('disabled', true);

            let windowsBuildType;
            let windowsBuildVersion;

            let versionField = $('#windowsBuildVersion');
            versionField.change(function (event) {
                showScenariosIfWindowsInfoFilled();
            });

            let buildTypeField = $('#windowsBuildType');
            buildTypeField.change(function (event) {
                showScenariosIfWindowsInfoFilled();
            })
        }

        microsoftTeams.getContext(function (context) {
            config.context = context;
            // Format for tab links - simpler now, doesn't include the tab url anymore
            var tabUrl = "https://teams.microsoft.com/l/entity/{APP_ID}/{ENTITY_HASH}?context=%7B%22subEntityId%22%3Anull%2C%22channelId%22%3A%22{CHANNEL_ID}%22%7D&groupId={GROUP_ID}&tenantId={TENANT_ID}";

            var entityId = context.entityId;

            var channelId = context.channelId;
            // Make it url-safe
            channelId = channelId.replace(":", "%3A");
            channelId = channelId.replace("@", "%40");

            var groupId = context.groupId;

            var tid = context.tid;

            // Oh, I guess this only runs in the MSFT tenant
            if (tid != MSFT_TENANT_ID) {
                return;
            }

            // Currently only doing user preferences with Windows TAP
            if ((config.tap == "Windows") && (config.collectWindowsInfo)) {
                //userPrefs = getUserPrefs(context['userObjectId']);
                showScenariosIfWindowsInfoFilled();
            }

            var entityHash = djb2_hash(APP_ID + ":" + entityId.replace(/\+/g, " "));

            tabUrl = tabUrl.replace('{APP_ID}', APP_ID);
            tabUrl = tabUrl.replace('{ENTITY_HASH}', deeplinkDjb2Prefix + entityHash);
            tabUrl = tabUrl.replace('{CHANNEL_ID}', channelId);
            tabUrl = tabUrl.replace('{GROUP_ID}', groupId);
            tabUrl = tabUrl.replace('{TENANT_ID}', tid);
            //tabUrl = encodeURI(tabUrl);

            config.tabUrl = tabUrl;

            var params = {
                tabUrl: tabUrl,
                validationId: config.validationId,
                channelName: context.channelName,
                channelId: context.channelId,
                teamName: context.teamName,
                teamId: context.teamId,
            }
            ajaxRequest('POST', updateValidationTabUrlEndpoint, params, function () {
                console.log(tabUrl);
                console.log("Updated tab url");
            });

        })

        var cases = document.querySelectorAll('.case-panel');

        var totalCaseCount = cases.length;
        var totalVotedCount = 0;

        var windowsBuildTypeField = $('#windowsBuildType');
        var windowsBuildVersionField = $('#windowsBuildVersion');

        // Dummy values for initializing yourReportTable
        /*
        if (config.tap == "Windows") {

            let cId = 0;
            let emailForVoteLists = "null";

            var yourReportTable = $('#your-report-table').DataTable({
                info: false,
                paging: false,
                searching: false,
                ordering: false,
                autoWidth: false,
                ajax: {
                    url: "/api/caseVotes/" + cId + "/" + emailForVoteLists + "/" + "up",
                    type: "GET",
                    dataSrc: "votes",
                },
                columns: [
                    { "data": "comment" },
                    { "data": "public" },
                ],
                columnDefs: [
                    {
                        render: function (data, type, row) {
                            console.log(data);
                            let id = row._id;

                            let cell = "<i class='fa fa-pencil-alt edit-vote-comment edit-vote-pencil' id='edit-vote-comment-" + row._id + "' title='Edit comment'></i> " + '<span class="vote-comment editable-text" id="vote-comment-' + id + '">' + data + '</span>';
                            return cell;
                        },
                        targets: 0
                    },
                    {
                        render: function (data, type, row) {
                            let id = row._id;
                            if (data == true) {
                                return "<input type='checkbox' checked class='vote-public-checkbox' id='vote-public-" + id + "'></input>";
                            } else {
                                return "<input type='checkbox' class='vote-public-checkbox' id='vote-public-" + id + "'></input>";
                            }
                        },
                        targets: 2
                    }
                ],
                initComplete: bindEditButtons,
            });
        }
        */

        // Setup Known Issues table
        // (Deprecated)
        /*
        var knownIssuesTable = $('#knownIssuesTable').DataTable({
            paging: false,
            info: false,
            searching: false,
            sort: false,
            ajax: {
                url: "/api/issues/" + config.tag,
                type: "GET",
                        
                //dataSrc: "tenants"
                dataSrc: function (json) {
                    if (json.issues.length > 0) {
                        $('.knownIssues').show();
                    }
                    return json.issues;
                },
                error: function (xhr, status, err) {
                    console.log("An error occurred: " + status + " " + err);
                }
            },
        });
        */


        cases.forEach(function (kase) {
            //var cId = kase.querySelector('p.subtle').innerHTML;
            var cId = kase.id.replace("panel-", "");
            var tag = $('#validation-tag').text();
            var caseTitle = kase.querySelector('.case-text').textContent;
            let caseDescription = $(kase).find('.description-well').html();
            var upvoteButton = $(kase).find('button.btn-upvote');
            var commentButton = $(kase).find('button.btn-comment');
            var downvoteButton = $(kase).find('button.btn-downvote');
            
            var upvoteList = kase.querySelector('.upvotes');
            var downvoteList = kase.querySelector('.downvotes');

            //var deepLinkButton = kase.querySelector('p.deep-link');
            var deviceSelect = document.querySelector('#deviceSelect');
            var headsetSelect = document.querySelector('#walkieHeadset');
            //var teamsModeSelect = document.querySelector('#teamsMode');

            var radios = $(kase).find('button:radio');

            let voteParams = {
                validationId: config.validationId,
                tap: config.tap,
                tag: config.tag,
                userId: "me",
                userEmail: "someone@gmail.com",
                cId: cId,
                caseTitle: caseTitle,
            };

            var voteUrl = apiUrl + '/' + cId;
            var commentUrl = commentApiUrl + '/' + cId;

            microsoftTeams.getContext(function (context) {
                //console.log(context);
                let email = context['loginHint'];
                //let email = "test@gmail.com";


                var emailForVoteLists = cleanEmail(email);

                //emailForVoteLists = "test@something.onmicrosoft.com"
                //email = emailForVoteLists;

                var userOid = context['userObjectId'];

                voteParams.userId = context['userObjectId'];
                voteParams.userEmail = email;
                voteParams.url = config.tabUrl;
                voteParams.tap = config.tap;
                voteParams.context = context;

                // For client radio buttons
                $(kase).find('input:radio').change(function () {
                    let cId = $(this)[0].id.split("-")[0];
                    let name = $(this).attr('name');
                    
                    let upDown = $(this)[0].id.split("-")[2];
                    if (upDown == "works") {
                        upDown = "up";
                    } else {
                        upDown = "down";
                    }

                    voteParams.upDown = upDown;
                    voteParams.client = name;

                    let that = this;
                    $(this).parent().find('.thumbContainer').html(clientSpinner);

                    ajaxRequest('POST', voteUrl, voteParams, function () {
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

                // Fill in the correct case properties when launching the comment modal
                $(kase).find('button.btn-comment').click(function () {
                    $('#comment-id').text(cId);
                    $('#comment-caseTitle').text(caseTitle);
                });

                var tables = $(kase).find('.votes-table');

                tables.each(function () {
                    let table = $(this);

                    var dtable = table.DataTable({
                        paging: false,
                        info: false,
                        searching: false,
                        sort: false,
                        ajax: {
                            url: "/api/caseVotes",
                            type: "GET",
                            data: function (d) {
                                let tableId = table.attr("id");
                                let upDown = "up";
                                if (tableId.includes("up")) {
                                    upDown = "up";
                                } else {
                                    upDown = "down";
                                }

                                return {
                                    cId: cId,
                                    email: emailForVoteLists,
                                    backupEmail: context["loginHint"],
                                    upDown: upDown,
                                };
                            },
                            //dataSrc: "tenants"
                            dataSrc: function (json) {
                                let votesToRender = [];
                                let myVotes = [];
                                let otherVotes = [];

                                let tableId = table.attr("id");
                                let upDown = "up";
                                if (tableId.includes("up")) {
                                    upDown = "up";
                                } else {
                                    upDown = "down";
                                }

                                if (upDown == "up") {
                                    $(kase).find(".upvotes-header").html("Works (" + json.votes.length + ") ");
                                } else {
                                    $(kase).find(".downvotes-header").html("Fails (" + json.votes.length + ") ");
                                }

                                let caseHeader = $(kase).find('.case-text');
                                caseHeader.html(caseHeader.html().replace("(Fails)", ""));

                                json.votes.forEach(function (vote) {

                                    if (vote.currentUser) {
                                        myVotes.push(["<strong>" + vote.text + "</strong>"],);
                                        if (config.tap == "Teams") {
                                            if (!config.collectDeviceFeedback) {
                                                if (upDown == "up") {
                                                    upvoteButton.attr('disabled', true);
                                                    downvoteButton.attr('disabled', false);
                                                } else {
                                                    downvoteButton.attr('disabled', true);
                                                    upvoteButton.attr('disabled', false);
                                                }
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

                                        if (((config.clientsVector == null) || (config.clientsVector == 0)) && (!config.collectDeviceFeedback) && (config.validationId != WALKIE_TALKIE_VALIDATION_2) && (config.tap != 'Windows')) {
                                            if (upDown == "up") {
                                                $(kase).find('.panel-collapse').collapse('hide');
                                            }
                                        } else {
                                            if (config.validationId == WALKIE_TALKIE_VALIDATION) {
                                                configured_clients = walkie_clients;
                                            } else {
                                                let groupCount = $('.group-panel').length;
                                                let configured_clients = clients;

                                                if (config.clientsVector.length == groupCount * clients.length) {
                                                    configured_clients = clients;
                                                } else if (config.clientsVector.length == groupCount * old_clients.length) {
                                                    configured_clients = old_clients;
                                                }
                                            }

                                            // Mark all previous client votes as selected
                                            configured_clients.forEach(function (client) {
                                                let safeClient = client.replace(/[^\w]/gi, '_');
                                                //if (vote.currentUser)
                                                // TODO: What logic should be used for this? Hmm
                                                // Check if it's the current user, and has (client) in the text?
                                                if ((vote.currentUser) && (vote.text.toLowerCase().includes("(" + client.toLowerCase() + ")"))) {
                                                //if (vote.toLowerCase().includes(emailForVoteLists.toLowerCase() + " (" + client.toLowerCase() + ")")) {
                                                    if (upDown == "up") {
                                                        $(kase).find('#' + cId + '-' + safeClient + '-works').parent().addClass('active');
                                                    } else {
                                                        $(kase).find('#' + cId + '-' + safeClient + '-fails').parent().addClass('active');
                                                    }
                                                }
                                            })
                                        }
                                    } else {
                                        otherVotes.push([vote.text]);
                                    }
                                });

                                refreshGroupVoteCounts();

                                votesToRender = myVotes.concat(otherVotes);

                                return votesToRender;
                            },
                            error: function (xhr, status, err) {
                                console.log("An error occurred: " + status + " " + err);
                            }
                        },
                    });

                });

                // TODO: Validate size of each uploaded file, <60 MB
                /*
                $('#windows-report-form').on('change', function (e) {
                    console.log("Changed the case form");
                    console.log(document.getElementById("windows-report-form").files);
                    console.log($('#windows-report-form')[0].files);
                });
                */

                function submitWindowsReport(event, voteParams) {
                    //stop submit the form, we will post it manually.
                    event.preventDefault();

                    // Get form
                    var form = $('#windows-report-form')[0];

                    // Create an FormData object
                    var data = new FormData(form);

                    // If you want to add an extra field for the FormData
                    //data.append("comment", $('#windows-report-description-field').text());
                    data.append("comment", $('#windows-report-description-field').val().replace(/\r?\n/g, '<br>'));

                    // disable the submit button
                    disableAndSpin('#windows-report-submit');

                    for (var pair in data.entries()) {
                        console.log(pair);
                    }

                    $('#windows-report-submit-status').text("Uploading...");

                    if (config.collectDeviceFeedback) {
                        voteParams.device = deviceSelect.value;
                    }
                    if (config.collectHeadsetFeedback) {
                        voteParams.headset = headsetSelect.value;
                    }

                    voteParams.windowsBuildType = windowsBuildTypeField.val();
                    voteParams.windowsBuildVersion = windowsBuildVersionField.val();
                    voteParams.public = $('#votesPublicField').is(':checked');

                    voteParams.attachmentFilenames = [];

                    $.ajax({
                        type: "POST",
                        enctype: 'multipart/form-data',
                        url: "/api/upload/multiple",
                        data: data,
                        processData: false,
                        contentType: false,
                        cache: false,
                        timeout: 600000,
                        success: function (data) {
                            $("#result").text(data);
                            console.log("SUCCESS : ", data);

                            $('#windows-report-submit-status').text("Submitting feedback...");

                            voteParams.attachments = data.files;

                            voteParams.title = $('#windows-report-title-field').val();
                            //voteParams.reproSteps = $('#windows-report-repro-steps-field').val().replace(/\r?\n/g, '<br>');
                            voteParams.comment = $('#windows-report-description-field').val().replace(/\r?\n/g, '<br>');

                            let submitUrl = apiUrl + '/' + voteParams.cId;

                            if (voteParams.upDown == "comment") {
                                submitUrl = "../api/comments";
                            }                            

                            ajaxRequest('POST', submitUrl, voteParams, function () {
                                enableAndRemoveSpin("#windows-report-submit");

                                $('#windows-report-submit-status').text("Complete");
                                $('#windows-report-submit-status').text("");

                                $('#windows-report-modal').modal('hide');
                                resetWindowsReport();

                                if (voteParams.upDown != "comment") {
                                    tables.each(function () {
                                        $(this).dataTable().api().ajax.reload();
                                    });
                                }
                            });

                            //$("#windows-report-submit").attr("disabled", false);
                        },
                        error: function (e) {
                            // TODO: Do more helpful stuff, probably still submit the text feedback
                            $("#result").text(e.responseText);
                            $('#windows-report-submit-status').text("Error: " + e.responseText);
                            console.log("ERROR : ", e);
                            enableAndRemoveSpin('#windows-report-submit');
                        }
                    });
                }

                if (config.tap == "Windows") {
                    upvoteButton.attr("data-target", "#windows-report-modal");
                    upvoteButton.attr("type", "submit");
                    upvoteButton.attr("data-toggle", "modal");

                    // TODO: Launch the upvote modal from the header
                    //$('.upvotes-header').attr("data-target", "#windows-report-modal");
                    //$('.upvotes-header').attr("type", "submit");
                    //$('.upvotes-header').attr("data-toggle", "modal");

                    downvoteButton.attr("data-target", "#windows-report-modal");


                    commentButton.attr("data-target", "#windows-report-modal");
                    commentButton.attr("type", "submit");
                    commentButton.attr("data-toggle", "modal");


                    upvoteButton.click(function () {
                        $('#windows-report-header').text("Report success for: " + voteParams.caseTitle);
                        $('#windows-report-description').html(caseDescription);

                        $('#windows-report-title-field').attr("placeholder", "Title your success feedback.");
                        $('#windows-report-title-required').show();

                        $('#windows-report-repro-steps-field').attr("placeholder", "Provide repro steps if necessary.");
                        $('#windows-report-repro-steps-required').hide();

                        $('#windows-report-description-field').attr("placeholder", "You can provide optional feedback. Is there anything about this scenario you would like to work differently?");
                        $('#windows-report-description-required').hide();


                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);

                        voteParams.upDown = "up";

                        $('#windows-report-submit').attr('disabled', true);


                        $('.windows-report-field').off();
                        $('.windows-report-field').on('change input', function (e) {
                            let title = $('#windows-report-title-field').val();
                            //let reproSteps = $('#windows-report-repro-steps-field').val();
                            let description = $('#windows-report-description-field').val();
                            if (title) {
                                $('#windows-report-submit').attr('disabled', false);
                            } else {
                                $('#windows-report-submit').attr('disabled', true);
                            }
                        });

                        $('#windows-report-submit').off();
                        $('#windows-report-submit').click(function () {
                            $('#windows-report-submit').attr('disabled', true);
                            submitWindowsReport(event, voteParams);
                        });

                    });


                    downvoteButton.click(function () {
                        $('#windows-report-header').text("Report a problem for: " + voteParams.caseTitle);

                        $('#windows-report-title-field').attr("placeholder", "Title your problem.");
                        $('#windows-report-title-required').show();

                        $('#windows-report-repro-steps-field').attr("placeholder", "Please provide repro steps.");
                        $('#windows-report-repro-steps-required').show();

                        $('#windows-report-description-field').attr("placeholder", "Please give any details that may be helpful.");
                        $('#windows-report-description-required').show();

                        $('#windows-report-description').html(caseDescription);


                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);

                        voteParams.upDown = "down";

                        $('#windows-report-submit').attr('disabled', true);


                        $('.windows-report-field').off();
                        $('.windows-report-field').on('change input', function (e) {
                            let title = $('#windows-report-title-field').val();
                            //let reproSteps = $('#windows-report-repro-steps-field').val();
                            let description = $('#windows-report-description-field').val();
                            if (title && description) {
                                $('#windows-report-submit').attr('disabled', false);
                            } else {
                                $('#windows-report-submit').attr('disabled', true);
                            }
                        });

                        $('#windows-report-submit').off();
                        $('#windows-report-submit').click(function () {
                            $('#windows-report-submit').attr('disabled', true);
                            submitWindowsReport(event, voteParams);
                        });
                    
                    });

                    commentButton.click(function () {
                        $('#windows-report-header').text("Submit feedback for: " + caseTitle);
                        $('#windows-report-description').html(caseDescription);

                        $('#windows-report-title-field').attr("placeholder", "Title your feedback.");
                        $('#windows-report-title-required').show();

                        $('#windows-report-repro-steps-field').attr("placeholder", "Please provide repro steps.");
                        $('#windows-report-repro-steps-required').hide();

                        $('#windows-report-description-field').attr("placeholder", "Please give any details that may be helpful.");
                        $('#windows-report-description-required').show();


                        $('#windows-report-id').text(cId);
                        $('#windows-report-name').text(caseTitle);

                        voteParams.upDown = "comment";

                        $('#windows-report-submit').attr('disabled', true);


                        $('.windows-report-field').off();
                        $('.windows-report-field').on('change input', function (e) {
                            let title = $('#windows-report-title-field').val();
                            //let reproSteps = $('#windows-report-repro-steps-field').val();
                            let description = $('#windows-report-description-field').val();
                            if (title && description) {
                                $('#windows-report-submit').attr('disabled', false);
                            } else {
                                $('#windows-report-submit').attr('disabled', true);
                            }
                        });

                        $('#windows-report-submit').off();
                        $('#windows-report-submit').click(function () {
                            submitWindowsReport(event, voteParams);
                        });

                    });

                    $('#windows-report-modal').on('hidden.bs.modal', function (e) {
                        // Takedown of state/fields when modal closes
                        $('#windows-report-submit').attr('disabled', false);
                        $('#windows-report-title-field').val("");
                        $('#windows-report-repro-steps-field').val("");
                        $('#windows-report-description-field').val("");
                    });

                } else {
                    upvoteButton.click(function () {
                        voteParams.upDown = "up";
                        upvoteButton.attr('disabled', true);
                        upvoteButton.html(upvoteButton.html().replace(thumbsUp, spinner));
                        if (config.collectDeviceFeedback) {
                            voteParams.device = deviceSelect.value;

                            if (config.collectHeadsetFeedback) {
                                voteParams.headset = headsetSelect.value;
                            }

                            if (cId == "956385") {
                                // networkScenarios = a list of the names of all checked boxes in network-scenarios
                                voteParams.networkScenarios = $('input[type="checkbox"][name="network-scenarios"]:checked').map(function () { return this.value; }).get();
                            } 

                            //voteParams.teamsMode = teamsModeSelect.value;
                        }

                        //if (config.tap == "Windows") {
                        //    voteParams.windowsBuildType = windowsBuildTypeField.val();
                        //    voteParams.windowsBuildVersion = windowsBuildVersionField.val();
                        //}


                        ajaxRequest('POST', voteUrl, voteParams, function () {
                            //ajaxRequest('GET', voteUrl, {}, updateVotes);
                            console.log("Done");
                            tables.each(function () {
                                console.log(this);
                                $(this).dataTable().api().ajax.reload();
                            });
                            upvoteButton.html(upvoteButton.html().replace(spinner, thumbsUp));
                            downvoteButton.attr('disabled', false);
                        });
                    });

                    downvoteButton.click(function () {
                        voteParams.upDown = "down";
                        downvoteButton.attr('disabled', true);
                        downvoteButton.html(downvoteButton.html().replace(thumbsDown, spinner));
                        if (config.collectDeviceFeedback) {
                            voteParams.device = deviceSelect.value;
                            //voteParams.teamsMode = teamsModeSelect.value;
                        }
                        if (config.collectHeadsetFeedback) {
                            voteParams.headset = headsetSelect.value;
                        }

                        ajaxRequest('POST', voteUrl, voteParams, function () {
                            //ajaxRequest('GET', voteUrl, {}, updateVotes);
                            tables.each(function () {
                                $(this).dataTable().api().ajax.reload();
                            });
                            downvoteButton.html(downvoteButton.html().replace(spinner, thumbsDown));
                            upvoteButton.attr('disabled', false);
                            $('#report-modal').modal('show');
                        });
                    });

                    commentButton.attr("data-target", "#comment-modal");
                    commentButton.attr("type", "submit");
                    commentButton.attr("data-toggle", "modal");

                }
            });
        });
        
        if (config.tap == "Windows") {
            // General Feedback and Feature Requests
            $('.otherActions').show();
            $('.featureRequests').show();

            // Trying some new architecture
            microsoftTeams.getContext(function (context) {
                setupFeatureRequests(context);
            })
        }
    });
})();