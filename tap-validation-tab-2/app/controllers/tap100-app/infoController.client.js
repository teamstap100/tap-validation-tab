'use strict';

(function () {

    var contentUrlBase = window.location.href.replace("/config", "");

    var phases = [
        ['Feature prioritization', 'feature-prioritization', 'PM, Engineering'],
        ['Feature planning', 'feature-planning', 'PM, Engineering'],
        ['Feature testing (goal: quality)', 'feature-testing', 'PM, Engineering, Field, Marketing'],
        ['Feature validation (goals: quality, usage/adoption and love)', 'feature-validation', 'PM, Engineering'],
        ['Customer recruitment', 'customer-recruitment', 'PM, Engineering, Field, Marketing'],
        ['Customer management', 'customer-management', 'Field, Marketing'],
        ['Customer performance', 'customer-performance', 'PM, Engineering, Field, Marketing'],
        ['TAP100 factory tour', 'tap100-factory', 'PM'],
        //'Customer engagement'
    ]

    $().ready(function () {
        console.log("Client running");

        $('a').attr('target', '_blank');

        $('.switchRole').click(function () {
            $('#roleSelect').prop('selectedIndex', 0);
            $('.phaseSelect').prop('selectedIndex', 0);

            console.log("Set role and phase select things to 0");

            $('.role-info').fadeOut('fast', function () {
                console.log("Faded out role-info");
                $('#phaseSelectContainer').fadeOut('fast', function () {
                    $('#ratingFooter').fadeOut('fast');

                    $('#role-select-form').fadeIn('fast');

                    // Select role again if it's there
                    //let userRoleId = localStorage.getItem("roleId");
                    //if (userRoleId) {
                    //    $('#roleSelect').val(userRoleId).change();
                    //}
                });
            });

        })

        $('#roleSelect').change(function () {
            var roleId = $('#roleSelect option:selected').val();
            var roleName = $('#roleSelect option:selected').text();
            console.log(roleName);
            localStorage.setItem("roleId", roleId);

            /*
            $('.role-form:not(#' + roleId + "-form)").fadeOut(function () {
                $('#' + roleId + "-form").fadeIn();
            });
            */

            $('#phaseSelectContainer').fadeIn('fast');

            $('.phaseSelect option').remove();
            $('.phaseSelect').append("<option></option>");

            phases.forEach(function (phase) {
                if (phase[2].includes(roleName)) {
                    console.log(roleName + " " + phase[0]);
                    $('.phaseSelect').append("<option value=" + phase[1] + " name=" + phase[0] + ">" + phase[0] + "</option>");
                }
            });


        });

        $('.phaseSelect').change(function () {
            // Propagate this change to all selectors
            let phase = $(this).find('option:selected').val();
            $('.phaseSelect').val(phase);


            //let phase = $('.phaseSelect option:selected').val();

            console.log(phase);
            localStorage.setItem('phase', phase);

            var roleId = $('#roleSelect option:selected').val();

            if (roleId) {
                $('.phase-content').hide();
                $('.phase-content').parent().hide();

                //$('ul').hide();

                //$('li').css('list-style', 'none');
                //$('h4').hide();

                //console.log("Showing:");
                //console.log($('.' + phase));
                $('.' + phase).show();
                $('.' + phase).parent().show();
                //$('.' + phase + " ul").show();
            
                $('.role-info:not(#' + roleId + "-info)").fadeOut(function () {
                    $('#' + roleId + "-info").fadeIn();
                });

                $('#role-select-form').hide();

                $('#ratingFooter').fadeIn();
            }
            
        })

        $('.rating').click(function () {
            $('#ratingConfirmation').fadeIn();
        })

        // Testing
        //localStorage.clear();


        // Get the role selected last time, if it exists in localStorage
        let userRoleId = localStorage.getItem("roleId");
        let phase = localStorage.getItem("phase");
        console.log(userRoleId);
        console.log(phase);
        if (userRoleId) {
            $('#roleSelect').val(userRoleId).change();

            if (phase) {
                $('.phaseSelect').val(phase).change();
            }
            else {
                $('#role-select-form').show();
                $('#ratingFooter').hide();
                $('#phaseSelectContainer').show();
            }
        } else {
            $('#role-select-form').show();
            $('#ratingFooter').hide();
            $('#phaseSelectContainer').hide();
        }
    });

})();