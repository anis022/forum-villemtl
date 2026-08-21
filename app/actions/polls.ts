"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isBlocked } from "@/utils/moderation";
import { DEFAULT_LOCALE, isLocale, type ErrorCode, type Locale } from "@/utils/i18n";
import { BOROUGH_BOUNDS } from "@/utils/map";
import { CATEGORY_KEYS, type Category } from "@/utils/issues";
import { imageFileToWebp } from "@/utils/server-image";
import { translateForOffice } from "@/utils/official-translation";

export type PollActionState = {
  error: ErrorCode | null;
  values?: {
    question?: string;
    description?: string;
    category?: string;
    options?: string[];
    kind?: string;
    allowPinDescription?: boolean;
    allowPinImage?: boolean;
    maxPinsPerMember?: number;
    lat?: number | null;
    lon?: number | null;
  };
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function requireUser() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, canParticipate: false };

  const { data, error } = await supabase.rpc("viewer_is_member");
  return { supabase, user, canParticipate: !error && data === true };
}

const localeFrom = (formData: FormData): Locale => {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : DEFAULT_LOCALE;
};

export async function createPoll(
  _previous: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const question = String(formData.get("question") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const kind = String(formData.get("kind") ?? "choice").trim();
  const category = String(formData.get("category") ?? "general").trim();
  const options =
    kind === "choice" ? formData.getAll("options").map((value) => String(value).trim()) : [];
  const allowPinDescription = formData.get("allowPinDescription") === "on";
  const allowPinImage = formData.get("allowPinImage") === "on";
  const maxPinsPerMember = Number(formData.get("maxPinsPerMember") ?? 1);
  const values = {
    question,
    description,
    category,
    options,
    kind,
    allowPinDescription,
    allowPinImage,
    maxPinsPerMember,
  };

  // A map ballot collects photographs and pins from the public and is the one
  // that costs storage and moderation, so it stays with the office. A plain
  // choice ballot is a topic with radio buttons and belongs to whoever may post.
  if (kind === "map") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "official") return { error: "notAuthorized", values };
  }

  // A ballot is a topic now, so it answers to the topic's limits rather than to
  // a second set of its own: five to a hundred and fifty for the question, and
  // a body that has to say at least twenty characters' worth of why.
  if (question.length < 5) return { error: "pollQuestionTooShort", values };
  if (question.length > 150) return { error: "pollQuestionTooLong", values };
  if (description.trim().length < 20) return { error: "bodyTooShort", values };
  if (description.length > 5000) return { error: "pollDescriptionTooLong", values };
  if (!CATEGORY_KEYS.includes(category as Category)) return { error: "badCategory", values };
  if (kind !== "choice" && kind !== "map") return { error: "pollKindInvalid", values };
  if (!Number.isInteger(maxPinsPerMember) || maxPinsPerMember < 1 || maxPinsPerMember > 10) {
    return { error: "pollPinLimitInvalid", values };
  }
  if (kind === "choice") {
    if (options.length < 2 || options.length > 10) return { error: "pollOptionsCount", values };
    if (options.some((option) => option.length === 0)) {
      return { error: "pollOptionEmpty", values };
    }
    if (options.some((option) => option.length > 120)) {
      return { error: "pollOptionTooLong", values };
    }
    if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
      return { error: "pollOptionDuplicate", values };
    }
  }

  // Returns the *topic* id, because the topic is what was created; the ballot
  // is a row hanging off it that nothing outside this file needs to name.
  const { data, error } = await supabase.rpc("create_poll_topic", {
    p_title: question,
    p_body: description,
    p_category: category,
    p_kind: kind,
    p_options: options.map((label) => ({ id: null, label })),
    p_allow_pin_description: allowPinDescription,
    p_allow_pin_image: allowPinImage,
    p_max_pins: maxPinsPerMember,
  });

  if (isBlocked(error)) return { error: "messageRefused", values };
  if (error || typeof data !== "string") return { error: "pollPublishFailed", values };

  // A poll is a topic, so an official one is bilingual like any other. The
  // choices themselves stay in the language they were written in: they are
  // often a street name or a single word, and a machine rendering of "Sherbrooke"
  // is a risk taken for nothing.
  const translation = await translateForOffice(question, description, locale);
  if (translation) {
    await supabase.from("issues").update(translation).eq("id", data);
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/sujets/${data}`);
  redirect(`/${locale}/sujets/${data}`);
}

export async function submitMapPollResponse(
  pollId: string,
  issueId: string,
  _previous: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const rawLat = String(formData.get("lat") ?? "").trim();
  const rawLon = String(formData.get("lon") ?? "").trim();
  const lat = rawLat === "" ? null : Number(rawLat);
  const lon = rawLon === "" ? null : Number(rawLon);
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");
  const values = { description, lat, lon };

  const { data: poll } = await supabase
    .from("polls")
    .select("kind, allow_pin_description, allow_pin_image")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll || poll.kind !== "map") return { error: "pollKindInvalid", values };

  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "pollPinRequired", values };
  }
  if (
    lat < BOROUGH_BOUNDS[0][0] ||
    lat > BOROUGH_BOUNDS[1][0] ||
    lon < BOROUGH_BOUNDS[0][1] ||
    lon > BOROUGH_BOUNDS[1][1]
  ) {
    return { error: "locationOutside", values };
  }
  if (!poll.allow_pin_description && description) {
    return { error: "pollSettingMismatch", values };
  }
  if (description.length > 1000) return { error: "pollPinDescriptionTooLong", values };

  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (!poll.allow_pin_image) return { error: "pollSettingMismatch", values };
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) return { error: "imageType", values };
    if (image.size > MAX_IMAGE_BYTES) return { error: "imageTooBig", values };

    imagePath = `${user.id}/${pollId}/${crypto.randomUUID()}.webp`;
    let webp: Buffer;
    try {
      webp = await imageFileToWebp(image);
    } catch (conversionError) {
      console.error("[polls] pin image conversion:", conversionError);
      return { error: "imageType", values };
    }

    const { error: uploadError } = await supabase.storage
      .from("poll-pin-images")
      .upload(imagePath, webp, { contentType: "image/webp" });
    if (uploadError) return { error: "uploadFailed", values };
  }

  const { error } = await supabase.rpc("submit_poll_map_response", {
    p_poll_id: pollId,
    p_lat: lat,
    p_lon: lon,
    p_description: description,
    p_image_path: imagePath,
  });

  if (error && imagePath) {
    await supabase.storage.from("poll-pin-images").remove([imagePath]);
  }
  if (isBlocked(error)) return { error: "messageRefused", values };
  if (error?.message.includes("poll_pin_limit")) return { error: "pollPinLimitReached", values };
  if (error) return { error: "pollPinFailed", values };

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/sujets/${issueId}`);
  redirect(`/${locale}/sujets/${issueId}`);
}

export async function votePoll(
  pollId: string,
  issueId: string,
  _previous: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const optionId = String(formData.get("optionId") ?? "").trim();
  if (!optionId) return { error: "pollChoiceRequired" };

  const { error } = await supabase.rpc("cast_poll_vote", {
    p_poll_id: pollId,
    p_option_id: optionId,
  });
  if (error) return { error: "pollVoteFailed" };

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/sujets/${issueId}`);
  return { error: null };
}

/**
 * Rewrite a ballot's choices.
 *
 * Allowed to whoever may edit the topic, which the database decides rather than
 * this file. Renaming a choice keeps its votes, because an option keeps its id;
 * removing one takes its votes with it, which is the only honest thing to do
 * with a vote for something that is no longer on the paper. The form says so
 * before it submits.
 */
export async function savePollOptions(
  pollId: string,
  issueId: string,
  _previous: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const { supabase, user, canParticipate } = await requireUser();
  if (!user) return { error: "notSignedIn" };
  if (!canParticipate) return { error: "memberRequired" };

  const locale = localeFrom(formData);
  const ids = formData.getAll("optionId").map((value) => String(value));
  const labels = formData.getAll("options").map((value) => String(value).trim());
  const values = { options: labels };

  if (labels.length < 2 || labels.length > 10) return { error: "pollOptionsCount", values };
  if (labels.some((label) => label.length === 0)) return { error: "pollOptionEmpty", values };
  if (labels.some((label) => label.length > 120)) return { error: "pollOptionTooLong", values };
  if (new Set(labels.map((label) => label.toLocaleLowerCase())).size !== labels.length) {
    return { error: "pollOptionDuplicate", values };
  }

  const { error } = await supabase.rpc("save_poll_options", {
    p_poll_id: pollId,
    p_options: labels.map((label, i) => ({ id: ids[i] || null, label })),
  });

  if (isBlocked(error)) return { error: "messageRefused", values };
  if (error) return { error: "pollPublishFailed", values };

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/sujets/${issueId}`);
  redirect(`/${locale}/sujets/${issueId}`);
}
