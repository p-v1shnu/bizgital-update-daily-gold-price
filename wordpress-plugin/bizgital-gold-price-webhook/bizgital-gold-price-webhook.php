<?php
/**
 * Plugin Name: Bizgital Gold Price Webhook
 * Description: Receive signed gold-price payloads and display current rates with shortcode.
 * Version: 1.0.0
 * Author: Bizgital
 */

if (!defined('ABSPATH')) {
    exit;
}

const BIZGITAL_GOLD_PRICE_SECRET_OPTION     = 'bizgital_gold_price_secret';
const BIZGITAL_GOLD_PRICE_DATA_OPTION       = 'bizgital_gold_price_data';
const BIZGITAL_GOLD_PRICE_UPDATED_AT_OPTION = 'bizgital_gold_price_updated_at';

/* ================================================================
   Assets — wp_head / wp_footer (never inside shortcode output)
   ================================================================ */

// Flag set by the shortcode so assets are only injected on pages that use it
$GLOBALS['bizgital_gold_price_rendered'] = false;

add_action('wp_footer', function () {
    if (!$GLOBALS['bizgital_gold_price_rendered']) {
        return;
    }
    echo '<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n";
    echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";
    echo '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;700;800&display=swap" rel="stylesheet">' . "\n";
    echo '<style id="bizgital-gold-price-css">' . "\n";
    echo bizgital_gold_price_css();
    echo '</style>' . "\n";
    echo '<script id="bizgital-gold-price-js">' . "\n";
    echo bizgital_gold_price_js();
    echo '</script>' . "\n";
});

function bizgital_gold_price_css()
{
    return '
/* ================================================================
   Bizgital Gold Price — Dark Luxury
   ================================================================ */
.bizgital-gold-card {
    /* Light cream-gold palette */
    --bgp-bg-from:   #fdfaf0;
    --bgp-bg-mid:    #f5e8c0;
    --bgp-bg-to:     #e6cc8e;
    --bgp-border:    rgba(168,118,24,.28);
    --bgp-title:     #3e2600;
    --bgp-rule:      rgba(160,110,20,.22);
    --bgp-sec-h:     #5a3600;
    --bgp-label:     #6b4200;
    --bgp-value:     #2e1c00;
    --bgp-unit:      rgba(110,68,10,.65);
    --bgp-sell-acc:  #a86010;
    --bgp-buy-acc:   rgba(58,36,0,.5);
    --bgp-row-sell:  rgba(255,255,255,.72);
    --bgp-row-buy:   rgba(255,255,255,.42);
    --bgp-row-bdr:   rgba(168,118,24,.13);
    --bgp-sep:       rgba(160,110,20,.18);
    --bgp-updated:   rgba(59,36,0,.38);
    --bgp-pill-bg:   rgba(255,255,255,.55);
    --bgp-pill-bdr:  rgba(168,118,24,.35);
    --bgp-pill-fg:   #5a3600;
    --bgp-btn-on:    #3e2600;
    --bgp-btn-off:   rgba(255,255,255,.55);
    --bgp-btn-fg:    #5a3600;
    --bgp-btn-bdr:   rgba(90,54,0,.25);
    --bgp-r:   20px;
    --bgp-ri:  10px;
    --bgp-pad: 24px;

    font-family: "Noto Sans Lao", "Phetsarath OT", Georgia, serif;
    background: linear-gradient(158deg, var(--bgp-bg-from) 0%, var(--bgp-bg-mid) 55%, var(--bgp-bg-to) 100%);
    border: 1px solid var(--bgp-border);
    border-radius: var(--bgp-r);
    box-shadow: 0 10px 48px rgba(59,36,0,.12), 0 2px 8px rgba(59,36,0,.07),
                inset 0 1px 0 rgba(255,255,255,.8);
    color: var(--bgp-value);
    max-width: 680px;
    margin: 0 auto;
    padding: var(--bgp-pad);
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
}
/* Gold accent stripe */
.bizgital-gold-card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, #c89228 15%, #f0d060 50%, #c89228 85%, transparent);
    border-radius: var(--bgp-r) var(--bgp-r) 0 0;
}

/* ── Header ─────────────────────────────────────────── */
.bgp-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 0;
}
.bgp-header__left { flex: 1; min-width: 0; }
.bgp-card-title {
    margin: 0;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--bgp-title);
}

/* ── Date pill (below header rule, centered) ─────────── */
.bgp-header-rule {
    border: none;
    border-top: 1px solid var(--bgp-rule);
    margin: 14px 0 16px;
}
.bgp-datetime {
    display: flex;
    justify-content: center;
    margin-bottom: 4px;
}
.bgp-datetime-pill {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    background: var(--bgp-pill-bg);
    border: 1px solid var(--bgp-pill-bdr);
    border-radius: 100px;
    padding: 9px 24px;
    font-size: 14px;
    font-weight: 600;
    color: var(--bgp-pill-fg);
    white-space: nowrap;
    flex-wrap: wrap;
    justify-content: center;
}
.bgp-datetime-sep { opacity: .45; }

/* ── Language toggle ────────────────────────────────── */
.bgp-lang-toggle {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    margin-top: 2px;
}
.bizgital-lang-btn {
    border: 1px solid var(--bgp-btn-bdr);
    background: var(--bgp-btn-off);
    color: var(--bgp-btn-fg);
    border-radius: 100px;
    padding: 5px 14px;
    font-size: 13px;
    font-family: "Noto Sans Lao", "Phetsarath OT", Georgia, serif !important;
    font-weight: 500;
    cursor: pointer;
    line-height: 1.3;
    transition: background .14s, color .14s, border-color .14s;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}
.bizgital-lang-btn:hover { background: rgba(255,255,255,.12); }
.bizgital-lang-btn:focus-visible {
    outline: 2px solid var(--bgp-btn-on);
    outline-offset: 2px;
}
.bizgital-lang-btn.is-active {
    background: var(--bgp-btn-on);
    color: #fff4d8;
    border-color: var(--bgp-btn-on);
    font-weight: 700;
}

/* ── Section ────────────────────────────────────────── */
.bgp-section { margin-top: 24px; }
.bgp-section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 14px;
    font-size: 22px;
    font-weight: 700;
    color: var(--bgp-sec-h);
    letter-spacing: .3px;
}
.bgp-section-title__rule { flex: 1; height: 1px; background: var(--bgp-rule); }
.bgp-section-title__gem  { color: var(--bgp-sell-acc); font-size: 10px; user-select: none; }

/* ── Price rows ─────────────────────────────────────── */
.bgp-price-list { display: flex; flex-direction: column; gap: 7px; }
.bgp-row {
    display: flex;
    align-items: center;
    background: var(--bgp-row-sell);
    border: 1px solid var(--bgp-row-bdr);
    border-left: 3px solid var(--bgp-sell-acc);
    border-radius: 0 var(--bgp-ri) var(--bgp-ri) 0;
    padding: 12px 16px;
    gap: 10px;
}
.bgp-row--buy { background: var(--bgp-row-buy); border-left-color: var(--bgp-buy-acc); }
.bgp-row__label {
    flex: 1;
    font-size: 14px;
    color: var(--bgp-label);
    line-height: 1.35;
    min-width: 0;
}
.bgp-row__price { display: flex; align-items: baseline; gap: 5px; flex-shrink: 0; }
.bgp-row__number {
    font-size: 24px;
    font-weight: 800;
    color: var(--bgp-value);
    line-height: 1;
    letter-spacing: .2px;
    font-variant-numeric: tabular-nums;
}
.bgp-row__unit {
    font-size: 11px;
    font-weight: 500;
    color: var(--bgp-unit);
    letter-spacing: .4px;
    padding-bottom: 1px;
}
.bgp-group-sep { border: none; border-top: 1px dashed var(--bgp-sep); margin: 1px 0; }

/* ── Updated ─────────────────────────────────────────── */
.bgp-updated { margin: 16px 0 0; font-size: 11px; color: var(--bgp-updated); text-align: right; }

/* ── Empty state ─────────────────────────────────────── */
.bizgital-gold-price-empty {
    padding: 14px 18px;
    border-radius: 10px;
    background: #f5f5f5;
    color: #444;
    font-family: "Noto Sans Lao", "Phetsarath OT", "Segoe UI", sans-serif;
}

/* ── Responsive ─────────────────────────────────────── */
@media (max-width: 520px) {
    .bizgital-gold-card    { --bgp-pad: 16px; margin-left: 12px; margin-right: 12px; }
    .bgp-card-title        { font-size: 18px; }
    .bgp-section-title     { font-size: 18px; }
    .bgp-datetime-pill     { font-size: 13px; padding: 8px 18px; gap: 10px; }
    .bgp-row               { padding: 10px 13px; }
    .bgp-row__label        { font-size: 13px; }
    .bgp-row__number       { font-size: 21px; }
}
@media (max-width: 360px) {
    .bgp-card-title        { font-size: 16px; }
    .bgp-section-title     { font-size: 16px; }
    .bgp-row__number       { font-size: 18px; }
    .bizgital-lang-btn     { padding: 4px 10px; font-size: 12px; }
}
';
}

function bizgital_gold_price_js()
{
    return '
(function () {
    "use strict";

    function applyLang(card, lang) {
        card.setAttribute("data-lang", lang);
        card.querySelectorAll(".lang-lo").forEach(function (el) {
            el.style.display = (lang === "lo") ? "" : "none";
        });
        card.querySelectorAll(".lang-en").forEach(function (el) {
            el.style.display = (lang === "en") ? "" : "none";
        });
        card.querySelectorAll(".bizgital-lang-btn").forEach(function (b) {
            var on = b.getAttribute("data-lang") === lang;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }

    function formatNumber(value) {
        var n = Number(value);
        if (!Number.isFinite(n)) return "-";
        return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }

    function setTextForAll(card, selector, text) {
        card.querySelectorAll(selector).forEach(function (el) {
            el.textContent = text;
        });
    }

    function refreshCardData(card) {
        var endpoint = card.getAttribute("data-endpoint");
        if (!endpoint) return Promise.resolve();

        var url = endpoint + (endpoint.indexOf("?") === -1 ? "?" : "&") + "_t=" + Date.now();
        return fetch(url, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            }
        }).then(function (resp) {
            if (!resp.ok) {
                throw new Error("HTTP " + resp.status);
            }
            return resp.json();
        }).then(function (data) {
            if (!data || data.ok !== true || !data.data || !data.data.values) {
                return;
            }

            var payload = data.data;
            var values = payload.values || {};

            setTextForAll(card, "[data-bgp-date]", payload.date || "-");
            setTextForAll(card, "[data-bgp-time]", payload.time || "-");
            setTextForAll(card, "[data-bgp-updated]", payload.updated_at || "-");

            card.querySelectorAll("[data-bgp-key]").forEach(function (el) {
                var key = el.getAttribute("data-bgp-key");
                var value = values[key];
                el.textContent = formatNumber(value);
            });
        }).catch(function (error) {
            console.warn("Gold price refresh failed:", error && error.message ? error.message : error);
        });
    }

    function setupLiveRefresh(card) {
        if (card.getAttribute("data-live-init") === "1") {
            return;
        }
        card.setAttribute("data-live-init", "1");
        refreshCardData(card);

        var refreshMs = Number(card.getAttribute("data-refresh-ms") || "15000");
        if (!Number.isFinite(refreshMs) || refreshMs < 5000) {
            refreshMs = 15000;
        }
        setInterval(function () {
            refreshCardData(card);
        }, refreshMs);
    }

    function initAll() {
        document.querySelectorAll(".bizgital-gold-card[data-lang]").forEach(function (card) {
            applyLang(card, card.getAttribute("data-lang") || "lo");
            setupLiveRefresh(card);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
    } else {
        initAll();
    }

    document.addEventListener("click", function (e) {
        var btn = e.target.closest(".bizgital-lang-btn");
        if (!btn) return;
        var card = btn.closest(".bizgital-gold-card");
        if (!card) return;
        var lang = btn.getAttribute("data-lang");
        if (lang !== "lo" && lang !== "en") return;
        applyLang(card, lang);
    });

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible") return;
        document.querySelectorAll(".bizgital-gold-card[data-endpoint]").forEach(function (card) {
            refreshCardData(card);
        });
    });
}());
';
}

/* ================================================================
   REST API — webhook receiver
   ================================================================ */

add_action('rest_api_init', function () {
    register_rest_route('bizgital/v1', '/gold-price', [
        'methods'             => 'POST',
        'callback'            => 'bizgital_gold_price_receive_webhook',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('bizgital/v1', '/gold-price-latest', [
        'methods'             => 'GET',
        'callback'            => 'bizgital_gold_price_get_latest',
        'permission_callback' => '__return_true',
    ]);
});

/* ================================================================
   Admin settings page
   ================================================================ */

add_action('admin_menu', function () {
    add_options_page(
        'Bizgital Gold Price',
        'Bizgital Gold Price',
        'manage_options',
        'bizgital-gold-price',
        'bizgital_gold_price_render_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('bizgital_gold_price_settings', BIZGITAL_GOLD_PRICE_SECRET_OPTION, [
        'type'              => 'string',
        'sanitize_callback' => function ($value) { return trim((string) $value); },
        'default'           => '',
    ]);
});

/* ================================================================
   Shortcode — HTML only
   ================================================================ */

add_shortcode('bizgital_gold_price', function () {
    $GLOBALS['bizgital_gold_price_rendered'] = true;

    $payload = get_option(BIZGITAL_GOLD_PRICE_DATA_OPTION);
    if (!is_array($payload) || empty($payload['values']) || !is_array($payload['values'])) {
        return '<div class="bizgital-gold-price-empty">ຍັງບໍ່ມີຂໍ້ມູນລາຄາຄຳ / Gold price is not available yet.</div>';
    }

    $values      = $payload['values'];
    $date        = isset($payload['date']) ? (string) $payload['date'] : '-';
    $time        = isset($payload['time']) ? (string) $payload['time'] : '-';
    $updatedAt   = (int) get_option(BIZGITAL_GOLD_PRICE_UPDATED_AT_OPTION, 0);
    $updatedText = $updatedAt > 0 ? wp_date('Y-m-d H:i', $updatedAt) : '-';

    $row = function ($labelLo, $labelEn, $value, $key, $type = 'sell') {
        $number = is_numeric($value) ? number_format((float) $value, 0, '.', ',') : '-';
        return sprintf(
            '<div class="bgp-row bgp-row--%4$s">'
            . '<span class="bgp-row__label"><span class="lang-lo">%1$s</span><span class="lang-en">%2$s</span></span>'
            . '<span class="bgp-row__price">'
            .   '<span class="bgp-row__number" data-bgp-key="%5$s">%3$s</span>'
            .   '<span class="bgp-row__unit"><span class="lang-lo">ກີບ</span><span class="lang-en">LAK</span></span>'
            . '</span>'
            . '</div>',
            esc_html($labelLo), esc_html($labelEn), esc_html($number), esc_attr($type), esc_attr($key)
        );
    };

    $sec = function ($textLo, $textEn) {
        return sprintf(
            '<h4 class="bgp-section-title">'
            . '<span class="bgp-section-title__rule" aria-hidden="true"></span>'
            . '<span class="bgp-section-title__gem" aria-hidden="true">◆</span>'
            . '<span><span class="lang-lo">%s</span><span class="lang-en">%s</span></span>'
            . '<span class="bgp-section-title__gem" aria-hidden="true">◆</span>'
            . '<span class="bgp-section-title__rule" aria-hidden="true"></span>'
            . '</h4>',
            esc_html($textLo), esc_html($textEn)
        );
    };

    $latestEndpoint = esc_url(rest_url('bizgital/v1/gold-price-latest'));
    $html  = '<div class="bizgital-gold-card" data-lang="lo" data-endpoint="' . $latestEndpoint . '" data-refresh-ms="15000">';

    // Header row: title (left) + language toggle (right)
    $html .= '<div class="bgp-header">';
    $html .= '<div class="bgp-header__left">'
           . '<h3 class="bgp-card-title">'
           . '<span class="lang-lo">ອັບເດດລາຄາຄຳປະຈຳວັນ</span>'
           . '<span class="lang-en">Daily Gold Price Update</span>'
           . '</h3>'
           . '</div>';
    $html .= '<div class="bgp-lang-toggle" role="group" aria-label="ພາສາ / Language">'
           . '<button type="button" class="bizgital-lang-btn is-active" data-lang="lo" aria-pressed="true">ລາວ</button>'
           . '<button type="button" class="bizgital-lang-btn" data-lang="en" aria-pressed="false">EN</button>'
           . '</div>';
    $html .= '</div>';

    // Divider then centered date/time pill
    $html .= '<hr class="bgp-header-rule">';
    $html .= sprintf(
        '<div class="bgp-datetime">'
        . '<div class="bgp-datetime-pill">'
        .   '<span><span class="lang-lo">ວັນທີ: <span data-bgp-date>%1$s</span></span><span class="lang-en">Date: <span data-bgp-date>%1$s</span></span></span>'
        .   '<span class="bgp-datetime-sep" aria-hidden="true">·</span>'
        .   '<span><span class="lang-lo">ເວລາ: <span data-bgp-time>%2$s</span></span><span class="lang-en">Time: <span data-bgp-time>%2$s</span></span></span>'
        . '</div>'
        . '</div>',
        esc_html($date), esc_html($time)
    );

    // Gold Bar
    $html .= '<section class="bgp-section">';
    $html .= $sec('ລາຄາຄຳແທ່ງ', 'Gold Bar');
    $html .= '<div class="bgp-price-list">';
    $html .= $row('ລາຄາຂາຍ 1 ບາດ', 'Sell Price (1 Baht)', $values['bar_sell_one_baht'] ?? null, 'bar_sell_one_baht', 'sell');
    $html .= $row('ລາຄາຊື້ 1 ບາດ',  'Buy Price (1 Baht)',  $values['bar_buy_one_baht']  ?? null, 'bar_buy_one_baht', 'buy');
    $html .= '</div></section>';

    // Gold Ornament
    $html .= '<section class="bgp-section">';
    $html .= $sec('ລາຄາຄຳຮູບປະພັນ', 'Gold Ornament');
    $html .= '<div class="bgp-price-list">';
    $html .= $row('ລາຄາຂາຍ 1 ບາດ',    'Sell Price (1 Baht)',    $values['print_sell_one_baht']    ?? null, 'print_sell_one_baht', 'sell');
    $html .= $row('ລາຄາຊື້ 1 ບາດ',     'Buy Price (1 Baht)',     $values['print_buy_one_baht']     ?? null, 'print_buy_one_baht', 'buy');
    $html .= '<hr class="bgp-group-sep" aria-hidden="true">';
    $html .= $row('ລາຄາຂາຍ 1 ສະຫຼຶງ', 'Sell Price (1 Salueng)', $values['print_sell_one_salueng'] ?? null, 'print_sell_one_salueng', 'sell');
    $html .= $row('ລາຄາຊື້ 1 ສະຫຼຶງ',  'Buy Price (1 Salueng)',  $values['print_buy_one_salueng']  ?? null, 'print_buy_one_salueng', 'buy');
    $html .= '<hr class="bgp-group-sep" aria-hidden="true">';
    $html .= $row('ລາຄາຂາຍ 5 ຫຸນ',    'Sell Price (5 Houn)',    $values['print_sell_five_houn']   ?? null, 'print_sell_five_houn', 'sell');
    $html .= $row('ລາຄາຊື້ 5 ຫຸນ',     'Buy Price (5 Houn)',     $values['print_buy_five_houn']    ?? null, 'print_buy_five_houn', 'buy');
    $html .= '</div></section>';

    $html .= sprintf(
        '<p class="bgp-updated">'
        . '<span class="lang-lo">ອັບເດດ: <span data-bgp-updated>%s</span></span>'
        . '<span class="lang-en">Updated: <span data-bgp-updated>%s</span></span>'
        . '</p>',
        esc_html($updatedText), esc_html($updatedText)
    );

    $html .= '</div>';
    return $html;
});

/* ================================================================
   Webhook handler
   ================================================================ */

function bizgital_gold_price_value_keys()
{
    return [
        'bar_sell_one_baht', 'bar_buy_one_baht',
        'print_sell_one_baht', 'print_buy_one_baht',
        'print_sell_one_salueng', 'print_buy_one_salueng',
        'print_sell_five_houn', 'print_buy_five_houn',
    ];
}

function bizgital_gold_price_get_secret()
{
    if (defined('BIZGITAL_GOLD_PRICE_SECRET') && BIZGITAL_GOLD_PRICE_SECRET) {
        return (string) BIZGITAL_GOLD_PRICE_SECRET;
    }
    return (string) get_option(BIZGITAL_GOLD_PRICE_SECRET_OPTION, '');
}

function bizgital_gold_price_read_current_payload()
{
    $payload = get_option(BIZGITAL_GOLD_PRICE_DATA_OPTION);
    if (!is_array($payload) || !isset($payload['values']) || !is_array($payload['values'])) {
        return null;
    }

    $values = $payload['values'];
    if (!array_key_exists('print_sell_five_houn', $values) && array_key_exists('print_sell_five_tamlueng', $values)) {
        $values['print_sell_five_houn'] = $values['print_sell_five_tamlueng'];
    }
    if (!array_key_exists('print_buy_five_houn', $values) && array_key_exists('print_buy_five_tamlueng', $values)) {
        $values['print_buy_five_houn'] = $values['print_buy_five_tamlueng'];
    }

    $cleanValues = [];
    foreach (bizgital_gold_price_value_keys() as $key) {
        $raw = $values[$key] ?? null;
        $cleanValues[$key] = is_numeric($raw) ? (float) $raw : null;
    }

    $updatedAt = (int) get_option(BIZGITAL_GOLD_PRICE_UPDATED_AT_OPTION, 0);
    return [
        'date'            => isset($payload['date']) ? (string) $payload['date'] : '-',
        'time'            => isset($payload['time']) ? (string) $payload['time'] : '-',
        'values'          => $cleanValues,
        'updated_at'      => $updatedAt > 0 ? wp_date('Y-m-d H:i:s T', $updatedAt) : '-',
        'updated_at_unix' => $updatedAt,
    ];
}

function bizgital_gold_price_get_latest(WP_REST_Request $request)
{
    unset($request);
    $data = bizgital_gold_price_read_current_payload();
    if (!$data) {
        $response = new WP_REST_Response(['ok' => false, 'error' => 'gold_price_not_available'], 404);
    } else {
        $response = new WP_REST_Response(['ok' => true, 'data' => $data], 200);
    }
    $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    $response->header('Pragma', 'no-cache');
    $response->header('Expires', '0');
    return $response;
}

function bizgital_gold_price_receive_webhook(WP_REST_Request $request)
{
    $secret = bizgital_gold_price_get_secret();
    if (!$secret) {
        return new WP_REST_Response(['ok' => false, 'error' => 'secret_not_configured'], 503);
    }

    $timestamp = $request->get_header('x-bizgital-timestamp');
    $signature = $request->get_header('x-bizgital-signature');
    if (!$timestamp || !$signature) {
        return new WP_REST_Response(['ok' => false, 'error' => 'missing_signature_headers'], 401);
    }

    $requestTime = (int) $timestamp;
    if ($requestTime <= 0 || abs(time() - $requestTime) > 300) {
        return new WP_REST_Response([
            'ok'           => false,
            'error'        => 'invalid_or_expired_timestamp',
            'server_time'  => time(),
            'request_time' => $requestTime,
        ], 401);
    }

    $body     = (string) $request->get_body();
    $expected = 'sha256=' . hash_hmac('sha256', "{$timestamp}.{$body}", $secret);
    if (!hash_equals($expected, $signature)) {
        return new WP_REST_Response(['ok' => false, 'error' => 'signature_mismatch'], 401);
    }

    $payload = json_decode($body, true);
    if (!is_array($payload) || !isset($payload['values']) || !is_array($payload['values'])) {
        return new WP_REST_Response(['ok' => false, 'error' => 'invalid_payload'], 400);
    }

    $requiredKeys = bizgital_gold_price_value_keys();

    // Backward compatibility: accept legacy tamlueng keys and normalize to houn keys.
    if (!array_key_exists('print_sell_five_houn', $payload['values']) && array_key_exists('print_sell_five_tamlueng', $payload['values'])) {
        $payload['values']['print_sell_five_houn'] = $payload['values']['print_sell_five_tamlueng'];
    }
    if (!array_key_exists('print_buy_five_houn', $payload['values']) && array_key_exists('print_buy_five_tamlueng', $payload['values'])) {
        $payload['values']['print_buy_five_houn'] = $payload['values']['print_buy_five_tamlueng'];
    }
    foreach ($requiredKeys as $key) {
        if (!array_key_exists($key, $payload['values']) || !is_numeric($payload['values'][$key])) {
            return new WP_REST_Response(['ok' => false, 'error' => "invalid_value_{$key}"], 400);
        }
    }

    // Store only validated, known fields — reject arbitrary extra keys from the payload
    $cleanPayload = [
        'source'  => 'bizgital-update-daily-gold-price',
        'sent_at' => isset($payload['sent_at']) ? (string) $payload['sent_at'] : '',
        'date'    => preg_replace('/[^0-9\/]/', '', (string) ($payload['date'] ?? '')),
        'time'    => preg_replace('/[^0-9:]/', '', (string) ($payload['time'] ?? '')),
        'values'  => array_intersect_key(
            array_map('floatval', $payload['values']),
            array_flip($requiredKeys)
        ),
    ];

    update_option(BIZGITAL_GOLD_PRICE_DATA_OPTION, $cleanPayload, false);
    update_option(BIZGITAL_GOLD_PRICE_UPDATED_AT_OPTION, time(), false);
    bizgital_gold_price_purge_page_caches();

    return new WP_REST_Response(['ok' => true], 200);
}

function bizgital_gold_price_purge_page_caches()
{
    try {
        do_action('litespeed_purge_all');
    } catch (Throwable $e) {
        error_log('Bizgital Gold Price purge error (LiteSpeed): ' . $e->getMessage());
    }

    try {
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
        }
    } catch (Throwable $e) {
        error_log('Bizgital Gold Price purge error (WP Rocket): ' . $e->getMessage());
    }

    try {
        if (function_exists('sg_cachepress_purge_cache')) {
            sg_cachepress_purge_cache();
        }
    } catch (Throwable $e) {
        error_log('Bizgital Gold Price purge error (SiteGround): ' . $e->getMessage());
    }

    try {
        if (function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
        }
    } catch (Throwable $e) {
        error_log('Bizgital Gold Price purge error (W3 Total Cache): ' . $e->getMessage());
    }
}

function bizgital_gold_price_render_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $secret     = get_option(BIZGITAL_GOLD_PRICE_SECRET_OPTION, '');
    $webhookUrl = home_url('/wp-json/bizgital/v1/gold-price');
    ?>
    <div class="wrap">
        <h1>Bizgital Gold Price</h1>
        <p>Webhook URL: <code><?php echo esc_html($webhookUrl); ?></code></p>
        <p>Shortcode: <code>[bizgital_gold_price]</code></p>
        <form method="post" action="options.php">
            <?php settings_fields('bizgital_gold_price_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="<?php echo esc_attr(BIZGITAL_GOLD_PRICE_SECRET_OPTION); ?>">Webhook Secret</label></th>
                    <td>
                        <input
                            name="<?php echo esc_attr(BIZGITAL_GOLD_PRICE_SECRET_OPTION); ?>"
                            id="<?php echo esc_attr(BIZGITAL_GOLD_PRICE_SECRET_OPTION); ?>"
                            type="password"
                            class="regular-text"
                            value="<?php echo esc_attr($secret); ?>"
                            autocomplete="new-password"
                        />
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
