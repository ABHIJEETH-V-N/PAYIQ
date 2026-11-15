import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaytmSignInButton } from "@/components/app/PaytmButton";

describe("Paytm sign-in option", () => {
  it("offers Continue with PayTM but keeps it disabled for now", () => {
    render(<PaytmSignInButton />);

    const button = screen.getByRole("button", { name: /Continue with PayTM/i });

    expect(button).toBeDisabled();
    expect(screen.getByText(/Paytm sign-in is coming soon/i)).toBeInTheDocument();
  });
});
