// GENERATED FILE — DO NOT EDIT.
//
// Source of truth: backend/src/esign/rvhoopFields.ts in the RVParkManager repo.
// Regenerate with `npm run esign:sync-fields` there. That repo's test suite
// fails if this file has drifted, so editing it here is undone by the next run.
//
// RVHOOP FORK ADDITION. The catalog of park-management data a signing template
// can pre-populate, offered as the "Pre-populated RVHoop Fields" palette in the
// field editor. Every entry becomes a read-only TEXT field carrying an
// `rvhoop.token` in its fieldMeta; RVHoop resolves those tokens when it raises
// the document for a real booking. See the fork's docs/documenso-integration.md.

export type RvhoopFieldGroup =
  | 'Park'
  | 'Site'
  | 'Guest'
  | 'Stay'
  | 'Signing'
  | 'Rent & charges'
  | 'Deposits & fees'
  | 'Occupancy'
  | 'Rig'
  | 'Utilities'
  | 'Taxes'
  | 'Policies';

/** Palette display order — roughly the order a lease reads in. */
export const RVHOOP_FIELD_GROUPS: RvhoopFieldGroup[] = [
  'Park',
  'Site',
  'Guest',
  'Stay',
  'Signing',
  'Rent & charges',
  'Deposits & fees',
  'Occupancy',
  'Rig',
  'Utilities',
  'Taxes',
  'Policies',
];

export interface RvhoopFieldDef {
  /** Stable machine key, stored in the field's `fieldMeta.rvhoop.token`. */
  token: string;
  /** Palette entry, and the placed field's label. */
  label: string;
  group: RvhoopFieldGroup;
  /** What will print here, including when it prints nothing. */
  description: string;
  /** Sample value. Also the placed field's starting text, so an unresolved field reads as a placeholder. */
  example: string;
  /** Multi-line by nature (a breakdown, a rate table, a policy paragraph) — dropped at a taller default size. */
  block?: true;
}

export const RVHOOP_FIELDS: RvhoopFieldDef[] = [
  {
    token: 'park_name',
    label: 'RV Park Name',
    group: 'Park',
    description: "The park's public display name.",
    example: 'Sunset Pines RV Resort',
  },
  {
    token: 'park_legal_name',
    label: 'Park Legal Business Name',
    group: 'Park',
    description: 'The registered entity that is party to the agreement. Falls back to the display name when unset.',
    example: 'Sunset Pines Holdings LLC',
  },
  {
    token: 'park_address',
    label: 'RV Park Address',
    group: 'Park',
    description: "The park's street address.",
    example: '1420 Old Mill Road, Kerrville, TX 78028',
  },
  {
    token: 'park_phone',
    label: 'Park Phone',
    group: 'Park',
    description: 'Public contact phone. Blank until the park fills in its profile.',
    example: '(830) 555-0142',
  },
  {
    token: 'park_email',
    label: 'Park Email',
    group: 'Park',
    description: 'Public contact email — where replies to park mail are routed. Blank until set.',
    example: 'office@sunsetpines.com',
  },
  {
    token: 'park_website',
    label: 'Park Website',
    group: 'Park',
    description: "The park's website URL. Blank until set.",
    example: 'https://sunsetpines.com',
  },
  {
    token: 'park_business_type',
    label: 'Park Business Type',
    group: 'Park',
    description: "Legal form of the park's entity (LLC, corporation, sole proprietor, …). Blank until set.",
    example: 'LLC',
  },
  {
    token: 'park_tax_id',
    label: 'Park Tax ID (EIN)',
    group: 'Park',
    description: "The park's own EIN / tax ID, for documents that must state it. Blank until set.",
    example: '74-1234567',
  },
  {
    token: 'park_timezone',
    label: 'Park Timezone',
    group: 'Park',
    description: "IANA timezone the park's dates and check-in times are read in.",
    example: 'America/Chicago',
  },
  {
    token: 'park_check_in_time',
    label: 'Park Standard Check-in Time',
    group: 'Park',
    description: 'The park-wide check-in time. Use "Check-in Time" instead for the time this stay was actually given.',
    example: '3:00 PM',
  },
  {
    token: 'park_check_out_time',
    label: 'Park Standard Check-out Time',
    group: 'Park',
    description: 'The park-wide check-out time. Use "Check-out Time" for this stay\'s own.',
    example: '11:00 AM',
  },
  {
    token: 'park_description',
    label: 'Park Description',
    group: 'Park',
    description: "The park's public blurb. Blank until set.",
    example: 'Eighty shaded sites on the Guadalupe River, ten minutes from town.',
    block: true,
  },
  {
    token: 'lot_number',
    label: 'Site / Lot Number',
    group: 'Site',
    description: 'The lot this stay occupies, as the park numbers it.',
    example: '14',
  },
  {
    token: 'lot_type',
    label: 'Site Type',
    group: 'Site',
    description: 'What kind of site it is — RV, tent, or cabin.',
    example: 'RV',
  },
  {
    token: 'lot_accommodation_class',
    label: 'Site Accommodation Class',
    group: 'Site',
    description: 'The tax grouping for the unit supplied — the axis that decided which tax rules applied.',
    example: "Guest's own RV (space rental)",
  },
  {
    token: 'lot_max_length_ft',
    label: 'Site Max Rig Length (ft)',
    group: 'Site',
    description: 'Longest rig the site accepts, in feet.',
    example: '40',
  },
  {
    token: 'lot_width_ft',
    label: 'Site Width (ft)',
    group: 'Site',
    description: 'Site width in feet. Blank when not recorded.',
    example: '22',
  },
  {
    token: 'lot_amp_services',
    label: 'Site Electric Service',
    group: 'Site',
    description: 'Amp levels the pedestal offers. Reads "No electric service" when the site has none.',
    example: '30 amp, 50 amp',
  },
  {
    token: 'lot_water_hookup',
    label: 'Site Water Hookup',
    group: 'Site',
    description: 'Water service at the site.',
    example: 'Threaded ¾″',
  },
  {
    token: 'lot_sewer_hookup',
    label: 'Site Sewer Hookup',
    group: 'Site',
    description: 'Sewer service at the site.',
    example: '4″ threaded',
  },
  {
    token: 'lot_notes',
    label: 'Site Notes',
    group: 'Site',
    description: "The park's guest-facing notes about this specific site. Blank when there are none.",
    example: 'Tight left turn-in; shaded after 2pm.',
    block: true,
  },
  {
    token: 'guest_name',
    label: 'Guest Full Name',
    group: 'Guest',
    description: "Name on the booking. Not the same as Documenso's Name field, which fills from the signer's account.",
    example: 'Jane Smith',
  },
  {
    token: 'guest_first_name',
    label: 'Guest First Name',
    group: 'Guest',
    description: 'First name on the booking.',
    example: 'Jane',
  },
  {
    token: 'guest_last_name',
    label: 'Guest Last Name',
    group: 'Guest',
    description: 'Last name on the booking.',
    example: 'Smith',
  },
  {
    token: 'guest_email',
    label: 'Guest Email',
    group: 'Guest',
    description: 'Email on the booking.',
    example: 'jane.smith@example.com',
  },
  {
    token: 'guest_phone',
    label: 'Guest Phone',
    group: 'Guest',
    description: 'Phone on the booking.',
    example: '(512) 555-0198',
  },
  {
    token: 'stay_type',
    label: 'Stay Type',
    group: 'Stay',
    description: 'Nightly, Weekly, or Monthly — the cadence this stay is billed in.',
    example: 'Monthly',
  },
  {
    token: 'start_date',
    label: 'Start Date',
    group: 'Stay',
    description: 'Arrival date, ISO (YYYY-MM-DD).',
    example: '2026-08-01',
  },
  {
    token: 'start_date_long',
    label: 'Start Date (long)',
    group: 'Stay',
    description: 'Arrival date written out.',
    example: 'August 1, 2026',
  },
  {
    token: 'end_date',
    label: 'End Date',
    group: 'Stay',
    description: 'Departure date, ISO. Blank on an open-ended monthly stay.',
    example: '2027-08-01',
  },
  {
    token: 'end_date_long',
    label: 'End Date (long)',
    group: 'Stay',
    description: 'Departure date written out. Reads "Open-ended" when the stay has no end date.',
    example: 'August 1, 2027',
  },
  {
    token: 'start_date_day_of_week',
    label: 'Start Day of Week',
    group: 'Stay',
    description: 'Weekday the stay begins on, spelled out.',
    example: 'Saturday',
  },
  {
    token: 'start_date_day_number',
    label: 'Start Day Number',
    group: 'Stay',
    description: 'Day of the month the stay begins, 1–31. Not zero-padded — use "Start Date" for the padded ISO form.',
    example: '1',
  },
  {
    token: 'start_date_month_short',
    label: 'Start Month (short)',
    group: 'Stay',
    description: 'Abbreviated month the stay begins in.',
    example: 'Aug',
  },
  {
    token: 'start_date_month_long',
    label: 'Start Month (full)',
    group: 'Stay',
    description: 'Full month name the stay begins in.',
    example: 'August',
  },
  {
    token: 'start_date_month_number',
    label: 'Start Month Number',
    group: 'Stay',
    description: 'Month the stay begins, 1–12. Not zero-padded.',
    example: '8',
  },
  {
    token: 'start_date_year',
    label: 'Start Year',
    group: 'Stay',
    description: 'Four-digit year the stay begins in.',
    example: '2026',
  },
  {
    token: 'end_date_day_of_week',
    label: 'End Day of Week',
    group: 'Stay',
    description: 'Weekday the stay ends on, spelled out. Blank on an open-ended stay.',
    example: 'Sunday',
  },
  {
    token: 'end_date_day_number',
    label: 'End Day Number',
    group: 'Stay',
    description: 'Day of the month the stay ends, 1–31, not zero-padded. Blank on an open-ended stay.',
    example: '1',
  },
  {
    token: 'end_date_month_short',
    label: 'End Month (short)',
    group: 'Stay',
    description: 'Abbreviated month the stay ends in. Blank on an open-ended stay.',
    example: 'Aug',
  },
  {
    token: 'end_date_month_long',
    label: 'End Month (full)',
    group: 'Stay',
    description: 'Full month name the stay ends in. Blank on an open-ended stay.',
    example: 'August',
  },
  {
    token: 'end_date_month_number',
    label: 'End Month Number',
    group: 'Stay',
    description: 'Month the stay ends, 1–12, not zero-padded. Blank on an open-ended stay.',
    example: '8',
  },
  {
    token: 'end_date_year',
    label: 'End Year',
    group: 'Stay',
    description: 'Four-digit year the stay ends in. Blank on an open-ended stay.',
    example: '2027',
  },
  {
    token: 'check_in_time',
    label: 'Check-in Time',
    group: 'Stay',
    description: "Check-in time for this stay — the manager's per-booking override, else the park's standard.",
    example: '3:00 PM',
  },
  {
    token: 'check_out_time',
    label: 'Check-out Time',
    group: 'Stay',
    description: "Check-out time for this stay — the per-booking override, else the park's standard.",
    example: '11:00 AM',
  },
  {
    token: 'stay_nights',
    label: 'Nights',
    group: 'Stay',
    description: 'Nights booked. Blank on an open-ended stay. End date is the checkout day, so it is not counted.',
    example: '365',
  },
  {
    token: 'stay_months',
    label: 'Months',
    group: 'Stay',
    description: 'Whole months booked on a monthly stay. Blank on nightly/weekly and open-ended stays.',
    example: '12',
  },
  {
    token: 'plan_name',
    label: 'Lease Plan Name',
    group: 'Stay',
    description: 'The lease plan booked, as it was named at booking. Blank when the stay took plain site rates.',
    example: 'Premium Annual',
  },
  {
    token: 'rate_basis',
    label: 'Rate Basis',
    group: 'Stay',
    description: 'Which layer produced the rate — plan, tier, dynamic pricing, or a manager override.',
    example: 'Premium Annual plan',
  },
  {
    token: 'reservation_reference',
    label: 'Reservation Reference',
    group: 'Stay',
    description: "RVHoop's identifier for this booking, for support and for tying the document back to the record.",
    example: 'clx8k2p400001q9r3f7h2m1nz',
  },
  {
    token: 'billing_anchor_date',
    label: 'Recurring Rent Bills From',
    group: 'Stay',
    description: 'First of the month the recurring rent bills on. Blank on stays paid in full up front.',
    example: '2026-09-01',
  },
  {
    token: 'signed_date',
    label: 'Date Signed',
    group: 'Signing',
    description:
      "Date the agreement was signed, ISO, in the park's timezone. Blank until it is signed — on a document being sent out, use Documenso's own Date field instead.",
    example: '2026-07-26',
  },
  {
    token: 'signed_date_long',
    label: 'Date Signed (long)',
    group: 'Signing',
    description: 'Date the agreement was signed, written out. Blank until it is signed.',
    example: 'July 26, 2026',
  },
  {
    token: 'signed_date_day_of_week',
    label: 'Signed Day of Week',
    group: 'Signing',
    description: 'Weekday the agreement was signed on, spelled out. Blank until it is signed.',
    example: 'Sunday',
  },
  {
    token: 'signed_date_day_number',
    label: 'Signed Day Number',
    group: 'Signing',
    description: 'Day of the month it was signed, 1–31, not zero-padded. Blank until it is signed.',
    example: '26',
  },
  {
    token: 'signed_date_month_short',
    label: 'Signed Month (short)',
    group: 'Signing',
    description: 'Abbreviated month it was signed in. Blank until it is signed.',
    example: 'Jul',
  },
  {
    token: 'signed_date_month_long',
    label: 'Signed Month (full)',
    group: 'Signing',
    description: 'Full month name it was signed in. Blank until it is signed.',
    example: 'July',
  },
  {
    token: 'signed_date_month_number',
    label: 'Signed Month Number',
    group: 'Signing',
    description: 'Month it was signed, 1–12, not zero-padded. Blank until it is signed.',
    example: '7',
  },
  {
    token: 'signed_date_year',
    label: 'Signed Year',
    group: 'Signing',
    description: 'Four-digit year it was signed in. Blank until it is signed.',
    example: '2026',
  },
  {
    token: 'rate',
    label: 'Rate',
    group: 'Rent & charges',
    description: 'The stay\'s rate in its own cadence — per night, per week, or per month. Pair with "Rate Period".',
    example: '$850.00',
  },
  {
    token: 'rate_period',
    label: 'Rate Period',
    group: 'Rent & charges',
    description: 'The word the rate is per: night, week, or month.',
    example: 'month',
  },
  {
    token: 'monthly_rate',
    label: 'Monthly Rate',
    group: 'Rent & charges',
    description:
      "Rent per month. The stay's quoted rate on a monthly stay, otherwise the site's published monthly rate.",
    example: '$850.00',
  },
  {
    token: 'weekly_rate',
    label: 'Weekly Rate',
    group: 'Rent & charges',
    description: 'Rate per week. Blank when the site does not offer weekly stays.',
    example: '$295.00',
  },
  {
    token: 'daily_rate',
    label: 'Nightly Rate',
    group: 'Rent & charges',
    description: 'Rate per night. Blank when the site does not offer nightly stays.',
    example: '$52.00',
  },
  {
    token: 'due_today_total',
    label: 'Due Today Total',
    group: 'Rent & charges',
    description: 'Everything collected at booking, tax included. $0.00 on a stay that settles on arrival.',
    example: '$1247.31',
  },
  {
    token: 'due_today_breakdown',
    label: 'Due Today Breakdown',
    group: 'Rent & charges',
    description: 'The itemized due-today lines, one per row, with the total. Give this field room — it is a table.',
    example:
      'Rent — August 2026 …… $850.00\nSecurity deposit …… $850.00\nSales tax (8.250%) …… $70.13\nTotal …… $1770.13',
    block: true,
  },
  {
    token: 'due_on_arrival_total',
    label: 'Due on Arrival Total',
    group: 'Rent & charges',
    description: 'Everything collected at check-in, tax included. $0.00 when the stay settled at booking.',
    example: '$1770.13',
  },
  {
    token: 'due_on_arrival_breakdown',
    label: 'Due on Arrival Breakdown',
    group: 'Rent & charges',
    description: 'The itemized on-arrival lines with the total. Give this field room.',
    example: 'Rent — August 2026 …… $850.00\nAdvance deposit applied …… -$200.00\nTotal …… $650.00',
    block: true,
  },
  {
    token: 'due_to_lock_total',
    label: 'Due to Hold the Site',
    group: 'Rent & charges',
    description:
      'The non-refundable reservation fee collected to take the site off the market. $0.00 when none applies.',
    example: '$75.00',
  },
  {
    token: 'monthly_recurring_total',
    label: 'Monthly Recurring Total',
    group: 'Rent & charges',
    description: 'What bills every month after move-in — rent plus the fees that ride with it, tax included.',
    example: '$920.13',
  },
  {
    token: 'monthly_breakdown',
    label: 'Monthly Recurring Breakdown',
    group: 'Rent & charges',
    description: 'The itemized recurring lines with the total. Give this field room.',
    example: 'Rent …… $850.00\nExtra guest (1) …… $25.00\nSales tax (8.250%) …… $72.19\nTotal …… $947.19',
    block: true,
  },
  {
    token: 'first_month_prorated_amount',
    label: 'First Month (Prorated)',
    group: 'Rent & charges',
    description: "The prorated move-in month's rent. Blank when the first month is charged in full.",
    example: '$412.90',
  },
  {
    token: 'first_month_prorated_days',
    label: 'First Month Prorated Days',
    group: 'Rent & charges',
    description: 'Days the prorated move-in month covers. Blank when the first month is charged in full.',
    example: '15',
  },
  {
    token: 'prepaid_next_month_amount',
    label: 'First Full Month, Prepaid',
    group: 'Rent & charges',
    description:
      'A whole month collected alongside a prorated move-in month. Only under the prorate-plus-next-month policy.',
    example: '$850.00',
  },
  {
    token: 'final_month_prorated_amount',
    label: 'Final Partial Month',
    group: 'Rent & charges',
    description:
      'One-time charge for the days in a shortened final month. Blank when the stay ends on a month boundary.',
    example: '$275.27',
  },
  {
    token: 'final_month_prorated_days',
    label: 'Final Partial Month Days',
    group: 'Rent & charges',
    description: 'Days in the shortened final month. Blank when there is no final partial month.',
    example: '10',
  },
  {
    token: 'extra_guest_fee',
    label: 'Extra Guest Fee (each)',
    group: 'Rent & charges',
    description: 'Charge per additional guest, per billing period. Blank when the park sets no guest limit.',
    example: '$25.00',
  },
  {
    token: 'extra_guest_total',
    label: 'Extra Guest Charge (this stay)',
    group: 'Rent & charges',
    description: "What this stay's guest count actually adds per period. $0.00 when within the included limit.",
    example: '$50.00',
  },
  {
    token: 'add_ons_list',
    label: 'Add-ons Purchased',
    group: 'Rent & charges',
    description: 'Add-ons bought with the stay, with prices. Reads "None" when there are none.',
    example: 'Boat slip — $80.00/month\nFirewood bundle — $25.00 one-time',
    block: true,
  },
  {
    token: 'security_deposit',
    label: 'Security Deposit',
    group: 'Deposits & fees',
    description: 'The refundable security deposit for this stay. $0.00 when none is charged.',
    example: '$850.00',
  },
  {
    token: 'pet_deposit',
    label: 'Pet Deposit',
    group: 'Deposits & fees',
    description: 'Refundable pet deposit. $0.00 when no pets or none charged.',
    example: '$150.00',
  },
  {
    token: 'electrical_deposit',
    label: 'Electrical Deposit',
    group: 'Deposits & fees',
    description: 'Refundable electrical deposit. $0.00 when none is charged.',
    example: '$100.00',
  },
  {
    token: 'water_deposit',
    label: 'Water Deposit',
    group: 'Deposits & fees',
    description: 'Refundable water deposit. $0.00 when none is charged.',
    example: '$50.00',
  },
  {
    token: 'total_refundable_deposits',
    label: 'Total Refundable Deposits',
    group: 'Deposits & fees',
    description: 'Every refundable deposit added up — the "what do I get back" figure.',
    example: '$1150.00',
  },
  {
    token: 'service_fee',
    label: 'Service Fee',
    group: 'Deposits & fees',
    description: 'Non-refundable one-time booking fee. $0.00 when none is charged.',
    example: '$35.00',
  },
  {
    token: 'application_fee',
    label: 'Application Fee',
    group: 'Deposits & fees',
    description: 'Non-refundable application fee. $0.00 when none is charged.',
    example: '$50.00',
  },
  {
    token: 'screening_fee',
    label: 'Screening Fee',
    group: 'Deposits & fees',
    description: 'Non-refundable background/screening fee. $0.00 when none is charged.',
    example: '$40.00',
  },
  {
    token: 'reservation_fee',
    label: 'Reservation Fee',
    group: 'Deposits & fees',
    description: 'Non-refundable fee that locks the site until arrival. Never credited against rent. $0.00 when none.',
    example: '$75.00',
  },
  {
    token: 'advance_deposit',
    label: 'Advance Reservation Deposit',
    group: 'Deposits & fees',
    description: 'Holding deposit collected at booking on a stay booked far ahead. $0.00 when none applies.',
    example: '$200.00',
  },
  {
    token: 'locked_from_date',
    label: 'Site Held From',
    group: 'Deposits & fees',
    description: 'First day a paid reservation fee blocks the site. Blank when the booking carries no lock.',
    example: '2026-07-26',
  },
  {
    token: 'num_guests',
    label: 'Number of Guests',
    group: 'Occupancy',
    description: 'Total occupants on the booking.',
    example: '3',
  },
  {
    token: 'num_adults',
    label: 'Number of Adults',
    group: 'Occupancy',
    description: "Adults, when the park's guest-fee age cutoff made the split meaningful. Blank otherwise.",
    example: '2',
  },
  {
    token: 'num_children',
    label: 'Number of Children',
    group: 'Occupancy',
    description: "Guests under the park's age cutoff. Blank when the park counts every guest alike.",
    example: '1',
  },
  {
    token: 'guests_included',
    label: 'Guests Included in Rate',
    group: 'Occupancy',
    description: 'Occupants the base rate covers before the extra-guest charge starts. Blank when unlimited.',
    example: '2',
  },
  {
    token: 'guest_age_cutoff',
    label: 'Guest Age Cutoff',
    group: 'Occupancy',
    description: "Age below which a guest does not count toward the site's limit. Blank when every guest counts.",
    example: '12',
  },
  {
    token: 'num_pets',
    label: 'Number of Pets',
    group: 'Occupancy',
    description: 'Pets on the booking.',
    example: '1',
  },
  {
    token: 'pets_included',
    label: 'Pets Included',
    group: 'Occupancy',
    description: 'Pets allowed before the pet deposit applies. Blank when not configured for this stay.',
    example: '1',
  },
  {
    token: 'num_vehicles',
    label: 'Number of Vehicles',
    group: 'Occupancy',
    description: 'Vehicles besides the rig.',
    example: '2',
  },
  {
    token: 'rig_type',
    label: 'Rig Type',
    group: 'Rig',
    description: 'What the guest is bringing. Blank when they did not say.',
    example: 'Fifth wheel',
  },
  {
    token: 'rig_length_ft',
    label: 'Rig Length (ft)',
    group: 'Rig',
    description: 'Rig length in feet. Blank when not recorded.',
    example: '34',
  },
  {
    token: 'rig_width_ft',
    label: 'Rig Width (ft)',
    group: 'Rig',
    description: 'Rig width in feet. Blank when not recorded.',
    example: '8',
  },
  {
    token: 'rig_height_ft',
    label: 'Rig Height (ft)',
    group: 'Rig',
    description: 'Rig height in feet. Blank when not recorded.',
    example: '13',
  },
  {
    token: 'rig_slide_outs',
    label: 'Rig Slide-outs',
    group: 'Rig',
    description: "Which sides the rig's slide-outs extend to. Blank when not recorded.",
    example: 'Both sides',
  },
  {
    token: 'rig_amp_needed',
    label: 'Electric Service Needed',
    group: 'Rig',
    description: 'Amp service the rig needs. Blank when not recorded.',
    example: '50 amp',
  },
  {
    token: 'rv_license_plate',
    label: 'RV License Plate',
    group: 'Rig',
    description: 'Plate on the rig. Blank when not recorded.',
    example: 'TX 8KJ2910',
  },
  {
    token: 'vehicle_license_plate',
    label: 'Vehicle License Plate',
    group: 'Rig',
    description: 'Plate on the tow/second vehicle. Blank when not recorded.',
    example: 'TX LMN4472',
  },
  {
    token: 'electric_terms',
    label: 'Electric Terms',
    group: 'Utilities',
    description:
      'How electric is billed for this stay, in words — included, flat fee, or metered with its allowance and overage rate.',
    example: '500 kWh included per period; $0.14 per kWh beyond it',
    block: true,
  },
  {
    token: 'water_terms',
    label: 'Water Terms',
    group: 'Utilities',
    description: 'How water is billed for this stay, in words. Metered water quotes per single gallon.',
    example: '3,000 gallons included per period; $0.0045 per gallon beyond it',
    block: true,
  },
  {
    token: 'electric_included_kwh',
    label: 'Electric Included (kWh)',
    group: 'Utilities',
    description: 'kWh included per billing period. Blank unless electric is metered on this stay.',
    example: '500',
  },
  {
    token: 'electric_overage_rate',
    label: 'Electric Overage Rate',
    group: 'Utilities',
    description: 'Charge per kWh beyond the allowance. Blank unless electric is metered.',
    example: '$0.14 per kWh',
  },
  {
    token: 'water_included_gallons',
    label: 'Water Included (gallons)',
    group: 'Utilities',
    description: 'Gallons included per billing period. Blank unless water is metered.',
    example: '3,000',
  },
  {
    token: 'water_overage_rate',
    label: 'Water Overage Rate',
    group: 'Utilities',
    description: 'Charge per gallon beyond the allowance. Blank unless water is metered.',
    example: '$0.0045 per gallon',
  },
  {
    token: 'electric_flat_fee',
    label: 'Electric Flat Fee',
    group: 'Utilities',
    description: 'Flat per-period electric charge. Blank unless electric bills a flat fee on this stay.',
    example: '$45.00',
  },
  {
    token: 'water_flat_fee',
    label: 'Water Flat Fee',
    group: 'Utilities',
    description: 'Flat per-period water charge. Blank unless water bills a flat fee on this stay.',
    example: '$30.00',
  },
  {
    token: 'tax_rate_table',
    label: 'Tax Rate Table',
    group: 'Taxes',
    description:
      'Each taxing authority reaching this stay, with its rate. Reads "Not taxed" when none apply. Give this field room.',
    example:
      'State sales tax (Texas) …… 6.250%\nCity sales tax (Kerrville) …… 2.000%\nHotel occupancy tax (Texas) …… 6.000%',
    block: true,
  },
  {
    token: 'tax_total_rate',
    label: 'Combined Tax Rate',
    group: 'Taxes',
    description: "Every percentage-based tax on this stay's rent, added together.",
    example: '14.250%',
  },
  {
    token: 'cancellation_policy',
    label: 'Cancellation Policy',
    group: 'Policies',
    description: 'The cancellation and refund terms disclosed to this guest at booking.',
    example: "Cancellations made fewer than 30 days before arrival forfeit the first month's rent.",
    block: true,
  },
  {
    token: 'move_out_notice_days',
    label: 'Move-out Notice (days)',
    group: 'Policies',
    description: 'Days of written notice required before moving out. "0" when none is required.',
    example: '30',
  },
  {
    token: 'move_out_notice_terms',
    label: 'Move-out Notice Terms',
    group: 'Policies',
    description: 'The notice requirement and what short notice costs, in words.',
    example:
      "30 days' written notice is required before moving out. Moving out with less notice is charged rent for the days of notice not given.",
    block: true,
  },
  {
    token: 'first_month_billing_terms',
    label: 'First Month Billing Terms',
    group: 'Policies',
    description: 'How the move-in month is charged, in words. Only meaningful on monthly stays.',
    example:
      'Rent bills on the 1st of each month. Moving in on or before the 15th is charged as a full month; moving in after it is charged only for the days remaining in that month.',
    block: true,
  },
  {
    token: 'last_month_billing_terms',
    label: 'Final Month Billing Terms',
    group: 'Policies',
    description: 'How a partial final month is charged, in words. Only meaningful on monthly stays.',
    example:
      'A partial final month is charged only for the days stayed, provided you leave on or before the 15th; leaving after it is charged as a full month.',
    block: true,
  },
  {
    token: 'partial_month_formula_terms',
    label: 'Proration Formula',
    group: 'Policies',
    description: "How a prorated month's rent is figured, in words. Only meaningful on monthly stays.",
    example:
      'A prorated month is figured as the monthly rate ÷ the number of days in that month, times the days stayed.',
    block: true,
  },
  {
    token: 'partial_month_fee_terms',
    label: 'Proration of Other Charges',
    group: 'Policies',
    description: 'What happens to extra-guest, flat-utility, and recurring add-on charges on a partial month.',
    example: 'Recurring charges beside rent are prorated across a partial month on the same day count as the rent.',
    block: true,
  },
  {
    token: 'advance_deposit_terms',
    label: 'Advance Deposit Terms',
    group: 'Policies',
    description:
      'What the holding deposit is applied to and whether it comes back. Blank when no advance deposit was collected.',
    example:
      '$200.00 is collected now to hold your site. It is applied to your arrival charges, and anything left over keeps paying your later invoices until it is used up.',
    block: true,
  },
  {
    token: 'reservation_fee_terms',
    label: 'Reservation Fee Terms',
    group: 'Policies',
    description: 'The non-refundability text shown with the site-lock fee. Blank when the booking carries no fee.',
    example:
      'A reservation fee of $75.00 takes Lot 14 off the market until your arrival. It is not refundable and it is not credited against your rent.',
    block: true,
  },
  {
    token: 'deposit_return_deadline_days',
    label: 'Deposit Return Deadline (days)',
    group: 'Policies',
    description: "Days after move-out the itemized deposit statement and refund are due, per the park's state.",
    example: '30',
  },
  {
    token: 'tenancy_threshold_days',
    label: 'Tenancy Threshold (days)',
    group: 'Policies',
    description: 'Continuous days of occupancy after which state law treats the occupant as a tenant.',
    example: '30',
  },
];

export const RVHOOP_FIELD_BY_TOKEN: Record<string, RvhoopFieldDef> = Object.fromEntries(
  RVHOOP_FIELDS.map((field) => [field.token, field]),
);

/**
 * The text a placed-but-unresolved field shows. Deliberately conspicuous: a
 * document sent outside RVHoop should read as obviously unfilled rather than
 * quietly print an empty box where a rent figure belongs.
 */
export const rvhoopPlaceholder = (label: string) => `«${label}»`;
