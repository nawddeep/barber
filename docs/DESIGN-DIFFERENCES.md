# Remaining differences from the designs

Checked against every screenshot in `/design` at 390, 768, 1024 and 1440 px. Anything not listed here matches closely.
"Why" says whether it is deliberate, forced by missing material, or a known gap.

## Photos and avatars (replace before launch)
| Where | Difference | Why |
|---|---|---|
| Hero, service cards, step 3 summary | One shave photo, cropped from a phone screenshot, so it is low resolution and looks soft at hero size. | No standalone photos were supplied. |
| Barbers | Four portraits cropped from a screenshot. | Same. |
| Barbers added later | Show initials on a yellow circle. | No photo exists for them. |
| Owner card (admin sidebar) and mobile home profile button | A person icon instead of the portrait. | The portrait belongs to a stranger in the mockup, not to this business. |

## Layout choices
| Where | Difference | Why |
|---|---|---|
| Landing, Popular services | Beard Trim is a wide card and the Haircut + Beard Combo spans the full width. The design leaves an empty cell and cuts the combo short. | The design looks cut off at that point. This avoids a hole. |
| Landing hero, hold panel | The OTP card is a picture only (not interactive). | It illustrates step 3. |
| Mobile screens | The design's glitches are not copied: icon overlapping the branch name, doubled back arrow, clipped rating chip. | They are rendering mistakes in the mockup. |
| Mobile step 2 | Button reads "Book a barber", as in the design, even though it continues to step 3. | Screenshot wins for wording. |
| Step 2 day strip | Arrow buttons page through the 14 days. | The design shows seven days and no way to reach the rest. |
| Admin dashboard "Up next" chips | "Fee paid", "OTP verified", "Fee pending", plus "Walk-in" for no-fee walk-ins. | The status list has no such labels, so they are derived from how the slot was held. |
| Admin bookings | Panel sits beside the list from 1400 px. Between 768 and 1399 px it opens as a drawer, below 768 px as a full-screen sheet. | At 1024 px a side panel squeezed the table until the "When" column was cut off. |
| Admin calendar | Same rule for the detail panel. Blocks use 72 px an hour (as briefed); the design's screenshot looks closer to 100 px an hour. | Brief wins for behaviour. |
| Admin calendar | Cancelled and no-show bookings are hidden. | They free the slot, and the legend has no colour for them. |
| Branches & fees | The green "active" card is the branch you last managed or added, not a fixed one. | The design does not say what makes a card active. |

## Numbers that differ because the data is generated
| Where | Difference |
|---|---|
| Dashboard | "Slots filled" shows about 6 to 9 %, not 78 %. The seed has about 12 bookings a day, as briefed, which fills few slots across four branches with 12 barbers. The figure is computed, not styled. |
| Dashboard | "Up next" is empty late in the day. Booking counts, fees and chips change with the date and the time of day. |
| Landing | "Next free slot", branch status ("Open now", "Busy today", "Closed now") and "4 branches · open 10 AM – 9 PM" are computed from the mock data and the clock. |

## Not designed, so derived
- No mobile screenshots exist for booking step 1, step 4, or any admin screen. They follow the desktop designs and the same visual language.
- Barbers, Customers, Payments and Settings in the admin sidebar are "Coming soon" pages. The designs only show them as menu items.
- Admin login, offline notice, error and retry blocks, empty states and the payment sheet are not in the designs.

## Accessibility notes
- Calendar blocks for a 30 minute booking are 34 px tall (the clock scale). They are wider than 44 px, and the booking panel's Reschedule button and Alt + arrow keys are the roomier alternatives. Every other control is at least 44 px.
- Lighthouse SEO for `/admin` scores 60 on purpose: the owner panel is marked noindex.
