"use server";

import { createClient } from "@/lib/supabase/server";
import {
  processMerchantCopilotMessage,
  CopilotMessage,
} from "@/lib/copilot/merchantCopilotEngine";

export interface CopilotActionResult {
  success: boolean;
  message?: CopilotMessage;
  error?: string;
}

/**
 * Server action to process user input in Falcon Merchant Copilot
 */
export async function sendCopilotMessageAction(
  userText: string
): Promise<CopilotActionResult> {
  try {
    if (!userText || !userText.trim()) {
      return {
        success: false,
        error: "الرسالة فارغة",
      };
    }

    const supabase = await createClient();
    const resultMessage = await processMerchantCopilotMessage(userText, supabase);

    return {
      success: true,
      message: resultMessage,
    };
  } catch (err: any) {
    console.error("Error in sendCopilotMessageAction:", err);
    return {
      success: false,
      error: err.message || "فشل الاتصال بمساعد فلكون الذكي",
    };
  }
}
