import { GameScreen } from "@/core/GameScreen";
import { gameMetadata } from "@/games/meta";

export const metadata = gameMetadata("swatches");

export default function Page() {
  return <GameScreen id="swatches" />;
}
