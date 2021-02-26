'use strict';

(function () {
    function cleanEmail(email) {
        console.log("Cleaning email");
        console.log(email);

        // Deal with undefined email
        if (!email) {
            return email;
        }

        email = email.toLowerCase();
        console.log(email);
        email = email.replace("#ext#@microsoft.onmicrosoft.com", "");
        console.log(email);
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
    
    function enableItAdminsLink() {
        $("#getR3Users").click(function () {
            var tid = $('input.tenantId').val();
            
            if (tid.length != 36) {
                return;
            }

            console.log(tid);

            $(this).html(spinner + $(this).html());

            $.ajax({
                type: 'GET',
                url: itAdminsApiUrl + tid,
                success: function (data) {
                    $('#getR3Users').html($('#getR3Users').html().replace(spinner, ""));
                    data = JSON.parse(data);
                    if (data.r3_users.length ) {
                        var adminList = data.r3_users
                        $('#r3Users').html("");
                        adminList.forEach(function (admin) {
                            admin = admin.trim();
                            if (admin.length > 0) {
                                $("#r3Users").append('<li>' + admin + '</li>');
                                maxUsers -= 1;
                                console.log(maxUsers);
                            }
                        });
                    } else {
                        $('#r3Users').html("No R3 users yet for this tenant.");
                    }

                }
            });
        })
    }


    function setup() {
        microsoftTeams.initialize();

        microsoftTeams.getContext(function (context) {
            ajaxRequestWithToken("GET", "/api/tenants", {}, function (data) {
                if (data) {
                    $('input.company').val(data.name);
                    $('input.tenantId').val(data.tid);

                    if (data.users) {
                        data.users.forEach(function (user) {
                            let deprovisionButton = `<button class='btn btn-secondary remove-btn ring-1_5' data-user=${JSON.stringify(user)} id='remove-${user.oid}'>Remove User from {RING}</button>`
                            let removalRequestedButton = `<button class='btn btn-secondary remove-btn ring-1_5' disabled data-user=${JSON.stringify(user)} id='remove-${user.oid}'>User pending removal</button>`
                            let userRow = `<tr><td>${user.name}</td><td>${user.email}</td><td>${user.oid}</td><td>${deprovisionButton}</td></tr>`;
                            if (user.removalRequested) {
                                console.log("This user was requested to be removed");
                                userRow = userRow.replace(deprovisionButton, removalRequestedButton);
                            }
                            if (user.ring == "R1.5") {
                                userRow = userRow.replace("{RING}", "R1.5");
                                $('#r1_5Users').append(userRow);
                                $('#r1_5UsersContainer').show();

                            } else if (user.ring == "R3") {
                                userRow = userRow.replace("ring-1_5", "ring3");
                                userRow = userRow.replace("{RING}", "R3");

                                $('#r3Users').append(userRow);
                                $('#r3UsersContainer').show();
                                //console.log("Found a R3 user");
                            }
                        });

                        let tableParams = {
                            info: false,
                            paging: false,
                        }

                        $('#r1_5UsersTable').dataTable(tableParams);
                        $('#r3UsersTable').dataTable(tableParams);

                        $('.remove-btn').click(requestRemoveUser);
                    } else {
                        console.log("No users found.");
                        $('#noUsersFound').show();

                    }
                }
            });
        });
    }

    function requestRemoveUser() {
        let that = this;
        $(this).attr('disabled', true);
        console.log(this);
        console.log("Removing user");
        let user = $(this).data('user');
        console.log(user);
        let ring = user.ring == "R1.5" ? "1.5" : "3";
        let params = {
            oid: user.oid,
            tid: $('input.tenantId').val(),
            email: user.email,
            name: user.name,
            ring: ring,
        };
        ajaxRequestWithToken("POST", "/api/users/deprovision", params, function (data) {
            $(that).text("User pending removal");
            console.log("Done");
        })
    }

    function ready(fn) {
        if (typeof fn !== 'function') {
            return;
        }

        if (document.readyState === 'complete') {
            return fn();
        }

        document.addEventListener('DOMContentLoaded', fn, false);
    }

    ready(setup);

})();