/// <reference path="typings/jquery.d.ts" />

var nend_params = { "media": 17546, "site": 85492, "spot": 204561, "type": 1, "oriented": 3 };

class AdLoader {
    private static adAreaId = 'adArea';
    private static getHtml() {
        return [
            '<a href="#popupAd" data-rel="popup" data-position-to="window" class="ui-btn ui-corner-all ui-shadow ui-btn-c" data-transition="pop">広告</a>',
            '<div data-role="popup" id="popupAd" data-theme="a">',
                '<div style="padding:30px 60px;">',
                    '<h1>広告スペース</h1>',
                    '<script type="text/javascript" src="http://js1.nend.net/js/nendAdLoader.js"></script>',
                '</div>',
            '</div>'
        ].join('\n');
    }

    static createAd() {
        alert('createAd');
        $('#' + AdLoader.adAreaId).html(AdLoader.getHtml()).trigger('create');
    }

    static deleteAd() {
        $('#' + AdLoader.adAreaId).html('');
    }
};