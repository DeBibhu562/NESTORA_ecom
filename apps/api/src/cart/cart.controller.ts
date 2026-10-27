import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { Public } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { CartService, ENGRAVING_MAX, MAX_QTY_PER_LINE } from "./cart.service";

const cookie: CookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 3600 * 1000 };
const addDto = z.object({
  variantId: z.string().min(1).max(40),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE).default(1),
  engraving: z.string().trim().max(ENGRAVING_MAX).default(""),
  isGift: z.boolean().default(false),
});
const qtyDto = z.object({ qty: z.number().int().min(0).max(MAX_QTY_PER_LINE) });
const couponDto = z.object({ code: z.string().trim().toUpperCase().min(1).max(40).nullable() });

@Public()
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get() get(@Req() req: Request) { return this.cart.viewByToken(req.cookies?.ct); }

  @Post("items") @HttpCode(200)
  async add(@Body(new ZodPipe(addDto)) b: z.infer<typeof addDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const c = await this.cart.add(req.cookies?.ct, b);
    if (c.token) res.cookie("ct", c.token, cookie);
    return this.cart.view(c.id);
  }

  @Patch("items/:id")
  async qty(@Param("id") id: string, @Body(new ZodPipe(qtyDto)) b: z.infer<typeof qtyDto>, @Req() req: Request) {
    return this.cart.view((await this.cart.setQty(req.cookies?.ct, id, b.qty)).id);
  }

  @Delete("items/:id")
  async remove(@Param("id") id: string, @Req() req: Request) {
    return this.cart.view((await this.cart.setQty(req.cookies?.ct, id, 0)).id);
  }

  @Put("coupon")
  async coupon(@Body(new ZodPipe(couponDto)) b: z.infer<typeof couponDto>, @Req() req: Request) {
    return this.cart.view((await this.cart.setCoupon(req.cookies?.ct, b.code)).id);
  }
}
