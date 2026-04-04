import { NextResponse } from "next/server";
import {
  createBooking,
  getAvailabilityForDate,
  getConfigData,
  updateBookingStatus,
} from "@/lib/bemyguest";

const PRODUCT_TYPE_UUID = "beb95299-4144-56ea-8764-882f3e67b31f";

function getNextWednesdayDate() {
  const date = new Date();
  const today = date.getDay();
  let add = (3 - today + 7) % 7;
  if (add === 0) add = 7;
  date.setDate(date.getDate() + add);
  return date.toISOString().slice(0, 10);
}

function hasRequiredAvailability(payload) {
  const availability = Array.isArray(payload?.data?.availability)
    ? payload.data.availability
    : [];
  const adult = availability.find((item) => item?.category === "adult");
  const child = availability.find((item) => item?.category === "child");
  return (Number(adult?.quantity) || 0) > 0 && (Number(child?.quantity) || 0) > 0;
}

export async function POST() {
  try {
    const arrivalDate = getNextWednesdayDate();
    const beforeConfig = await getConfigData();
    const beforeBalance = beforeConfig?.data?.user?.walletBlockedBalance;

    const availabilityPayload = await getAvailabilityForDate(PRODUCT_TYPE_UUID, arrivalDate);
    if (!hasRequiredAvailability(availabilityPayload)) {
      return NextResponse.json(
        {
          ok: false,
          message: "No adult+child availability found for selected date.",
          arrivalDate,
        },
        { status: 400 },
      );
    }

    const partnerReference = `task15-${Date.now()}`;
    const bookingPayload = {
      productTypeUuid: PRODUCT_TYPE_UUID,
      customer: {
        email: "integration.test@example.com",
        firstName: "Integration",
        lastName: "Tester",
        phone: "+6591234567",
        salutation: "Mr",
      },
      adults: 1,
      children: 1,
      seniors: 0,
      arrivalDate,
      partnerReference,
      options: {
        perBooking: [],
        perPax: [],
      },
    };

    const createResult = await createBooking(bookingPayload);
    const bookingUuid = createResult?.payload?.data?.uuid;
    if (!bookingUuid) {
      return NextResponse.json(
        {
          ok: false,
          message: "Booking create response did not return booking UUID.",
          createStatus: createResult?.status || null,
        },
        { status: 400 },
      );
    }

    const confirmResult = await updateBookingStatus(bookingUuid, "waiting");
    const afterConfig = await getConfigData();
    const afterBalance = afterConfig?.data?.user?.walletBlockedBalance;

    return NextResponse.json({
      ok: true,
      expectedResult: "SUCCESS",
      arrivalDate,
      bookingUuid,
      createStatus: createResult.status,
      confirmStatus: confirmResult.status,
      walletBlockedBalanceBefore: beforeBalance,
      walletBlockedBalanceAfter: afterBalance,
      partnerReference,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Task 15 execution failed.",
      },
      { status: 400 },
    );
  }
}
