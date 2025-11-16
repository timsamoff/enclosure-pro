import { SiInstagram } from "react-icons/si";
import { Book, Coffee } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import enclosureProIcon from "@/../../images/EnclosureProIcon.svg";

export default function AppIconMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          data-testid="button-app-menu"
        >
          <img src={enclosureProIcon} alt="Enclosure Pro" className="w-full h-full object-contain" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" data-testid="menu-app-dropdown">
        <DropdownMenuItem disabled className="flex flex-col items-start gap-1 py-3">
          <div className="font-semibold text-base">Enclosure Pro</div>
          <div className="text-xs text-muted-foreground">Version 1.0.0</div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://github.com/timsamoff/enclosure-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 cursor-pointer"
            data-testid="link-documentation"
          >
            <Book className="w-4 h-4" />
            <span>Documentation</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-3">
          <div className="text-xs text-muted-foreground mb-2">Created by Tim Samoff</div>
          <a
            href="https://www.instagram.com/circuitous.fx/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
            data-testid="link-instagram"
          >
            <span>Circuitous FX</span>
            <SiInstagram className="w-4 h-4" />
          </a>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://www.paypal.com/paypalme/circuitousfx"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 cursor-pointer"
            data-testid="link-buy-me-coffee"
          >
            <Coffee className="w-4 h-4" />
            <span>Buy Me a Cup of Coffee</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
