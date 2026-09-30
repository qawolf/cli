export const actExamples = `
Examples:
  $ qawolf runner act click --button left --x 480 --y 260
  $ qawolf runner act type --text "hello@example.com"
  $ qawolf runner act keypress --keys Control a
  $ qawolf runner act navigate --url https://example.com
  $ qawolf runner act drag --path '[{"x":10,"y":20},{"x":80,"y":90}]'
  $ qawolf runner act click --button left --x 480 --y 260 --screenshot step-4.jpg
  $ echo '{"type":"click","button":"left","x":1,"y":2}' | qawolf runner act -
  $ echo '{"type":"click","button":"left","x":1,"y":2}' | qawolf runner act - --screenshot - > step-5.jpg

Mobile:
  $ qawolf runner act tap --x 540 --y 1200
  $ qawolf runner act tap --selector '//*[@content-desc="Continue"]'
  $ qawolf runner act fill --selector 'name == "Postal code"' --strategy ios-predicate --text 94107
  $ qawolf runner act swipe --from 540,1600 --to 540,600 --duration-ms 1500`;
