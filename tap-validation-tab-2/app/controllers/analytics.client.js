'use strict';

(function () {
    $().ready(function () {
        microsoftTeams.initialize();

        var email;

        console.log("Tracking");
        microsoftTeams.getContext(function (context) {
            email = context['userPrincipalName']
            console.log(email);

            let data = {
                type: "visit",
                email: email
            };

            $.ajax({
                url: "/api/stats",
                method: "POST",
                data: JSON.stringify(data)  ,
                contentType: "application/json",
                success: function () {
                    console.log("Done");
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    console.log("Got an error");
                    console.log(thrownError);
                }
            })

            $('.rating').click(function () {
                console.log("Clicked");
                console.log(this.id);
                let data = {
                    type: "rating",
                    email: email,
                    rating: this.id,
                };

                $.ajax({
                    url: "/api/stats",
                    method: "POST",
                    data: JSON.stringify(data),
                    contentType: "application/json",
                    success: function () {
                        console.log("Done");
                    },
                    error: function (xhr, ajaxOptions, thrownError) {
                        console.log("Got an error");
                        console.log(thrownError);
                    }
                })
            })
        })


        $('#roleSelect').change(function () {
            var role = $('#roleSelect option:selected').attr('name');
            console.log("Role is now: " + role);

            let data = {
                type: "role",
                email: email,
                role: role
            };

            $.ajax({
                url: "/api/stats",
                method: "POST",
                data: JSON.stringify(data),
                contentType: "application/json",
                success: function () {
                    console.log("Done");
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    console.log("Got an error");
                    console.log(thrownError);
                }
            });
        });

        $('a').click(function () {
            console.log("Clicked this link: " + this);
            let data = {
                type: "link",
                url: this.href
            };

            $.ajax({
                url: "/api/stats",
                method: "POST",
                data: JSON.stringify(data),
                contentType: "application/json",
                success: function () {
                    console.log("Done");
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    console.log("Got an error");
                    console.log(thrownError);
                }
            });
        });

    });

})();