"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { Button, Input, SegmentedControl, Select, Toggle, useToast } from "@/components/ui";
import { ApiError, getSettings, saveSettings } from "@/lib/api";
import { useApi } from "@/lib/hooks/useApi";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";
import { settingsSchema } from "@/lib/settings-schema";
import type { HoldMode, Settings } from "@/lib/types";

const MODES: Array<{ value: HoldMode; label: string }> = [
  { value: "FEE_ONLY", label: "Fee only" },
  { value: "OTP_ONLY", label: "Phone OTP only" },
  { value: "CUSTOMER_CHOOSES", label: "Customer chooses" },
];

function Err({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="mt-1 text-sm font-medium text-orange-ink">{message}</p> : null;
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-bold text-ink">{title}</p>
        <p className="text-sm text-muted-strong">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** Booking fee rules. Saved settings apply to bookings made from then on. */
export function FeeRulesPanel() {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const saved = useApi(`fee-rules:${version}`, () => getSettings(), DEFAULT_SETTINGS as Settings);
  const settings = saved.data;
  const [serverError, setServerError] = useState<string | null>(null);

  // A number box that is switched off may be empty. Only check it while its switch is on.
  const resolver: Resolver<Settings> = (values, ctx, opts) => {
    const v = { ...values };
    if (!v.refundOnEarlyCancel && Number.isNaN(v.refundWindowHours)) v.refundWindowHours = settings.refundWindowHours;
    if (!v.requireFeeAfterNoShowsEnabled && Number.isNaN(v.requireFeeAfterNoShows)) v.requireFeeAfterNoShows = settings.requireFeeAfterNoShows;
    // The schema narrows the hold time to 10, 15 or 30; the form holds it as a plain number.
    return (zodResolver(settingsSchema) as unknown as Resolver<Settings>)(v, ctx, opts);
  };
  const { register, control, handleSubmit, trigger, formState: { errors, isDirty, isSubmitting } } = useForm<Settings>({
    resolver,
    values: settings,
    mode: "onChange",
  });
  const refundOn = useWatch({ control, name: "refundOnEarlyCancel" });
  const noShowOn = useWatch({ control, name: "requireFeeAfterNoShowsEnabled" });
  const refundHours = useWatch({ control, name: "refundWindowHours" });
  const noShowCount = useWatch({ control, name: "requireFeeAfterNoShows" });

  const onSubmit = async (values: Settings) => {
    setServerError(null);
    try {
      await saveSettings(values);
      setVersion((n) => n + 1);
      toast.show({ message: "Fee rules saved. They apply to new bookings only." });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} aria-label="Booking fee rules" className="rounded-card-lg bg-white p-6 sm:p-8">
      <h2 className="font-display text-3xl text-green">Booking fee rules</h2>
      <p className="mt-1 text-muted-strong">Applies to all branches unless overridden</p>

      <div className="mt-6">
        <p id="mode-label" className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-strong">How customers hold a slot</p>
        <Controller
          control={control}
          name="holdMode"
          render={({ field }) => <SegmentedControl label="How customers hold a slot" options={MODES} value={field.value} onChange={field.onChange} />}
        />
        <Err id="mode-err" message={errors.holdMode?.message} />
      </div>

      <div className="mt-6">
        <label htmlFor="fee" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-strong">Booking fee</label>
        <Input id="fee" type="number" inputMode="numeric" prefix="₹" step={1} invalid={!!errors.feeInr} aria-describedby="fee-err" {...register("feeInr", { valueAsNumber: true })} className="text-lg font-bold" />
        <Err id="fee-err" message={errors.feeInr?.message} />
      </div>

      <div className="mt-6 space-y-5">
        <Controller
          control={control}
          name="adjustFeeInBill"
          render={({ field }) => (
            <Row title="Adjust fee in final bill" hint="Customer pays the rest at the salon">
              <Toggle checked={field.value} onChange={field.onChange} label="Adjust fee in final bill" />
            </Row>
          )}
        />

        <div>
          <Controller
            control={control}
            name="refundOnEarlyCancel"
            render={({ field }) => (
              <Row title="Refund on early cancellation" hint={`Up to ${Number.isFinite(refundHours) ? refundHours : "…"} hours before the slot`}>
                <Toggle checked={field.value} onChange={(v) => { field.onChange(v); void trigger("refundWindowHours"); }} label="Refund on early cancellation" />
              </Row>
            )}
          />
          {refundOn && (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-cream p-3">
              <label htmlFor="refund-hours" className="text-sm font-medium text-ink">Hours before the slot</label>
              <Input id="refund-hours" type="number" inputMode="numeric" step={1} wrapperClassName="w-28" invalid={!!errors.refundWindowHours} aria-describedby="refund-err" {...register("refundWindowHours", { valueAsNumber: true })} />
            </div>
          )}
          <Err id="refund-err" message={errors.refundWindowHours?.message} />
        </div>

        <div>
          <Controller
            control={control}
            name="requireFeeAfterNoShowsEnabled"
            render={({ field }) => (
              <Row title={`Require fee after ${Number.isFinite(noShowCount) ? noShowCount : "…"} no-shows`} hint="For customers who chose OTP only">
                <Toggle checked={field.value} onChange={(v) => { field.onChange(v); void trigger("requireFeeAfterNoShows"); }} label="Require fee after repeated no-shows" />
              </Row>
            )}
          />
          {noShowOn && (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-cream p-3">
              <label htmlFor="noshows" className="text-sm font-medium text-ink">Number of no-shows</label>
              <Input id="noshows" type="number" inputMode="numeric" step={1} wrapperClassName="w-28" invalid={!!errors.requireFeeAfterNoShows} aria-describedby="noshow-err" {...register("requireFeeAfterNoShows", { valueAsNumber: true })} />
            </div>
          )}
          <Err id="noshow-err" message={errors.requireFeeAfterNoShows?.message} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="hold-minutes" className="font-bold text-ink">Hold unpaid slots</label>
            <p className="text-sm text-muted-strong">Released automatically after</p>
          </div>
          <Select id="hold-minutes" wrapperClassName="w-44 shrink-0" invalid={!!errors.unpaidHoldMinutes} {...register("unpaidHoldMinutes", { valueAsNumber: true })}>
            {[10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </Select>
        </div>
        <Err id="hold-err" message={errors.unpaidHoldMinutes?.message} />
      </div>

      {serverError && <p role="alert" className="mt-5 rounded-2xl bg-status-cancelled p-3 text-sm font-bold text-status-cancelled-ink">{serverError}</p>}
      <Button type="submit" size="lg" className="mt-7 w-full" disabled={!isDirty || isSubmitting}>{isSubmitting ? "Saving…" : "Save changes"}</Button>
      <p className="mt-3 text-center text-sm text-muted-strong">Applies to new bookings only. Bookings already made keep the fee they were booked with.</p>
    </form>
  );
}
