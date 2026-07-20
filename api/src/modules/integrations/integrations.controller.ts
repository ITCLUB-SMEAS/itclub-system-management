import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IntegrationsService } from './integrations.service';
import { DiscordNotifyDto } from './dto/discord-notify.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PENGURUS_ROLES } from '../../common/constants/roles';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('integrations')
export class IntegrationsController {
  constructor(private integrations: IntegrationsService) {}

  @Public()
  @Post('github/webhook')
  githubWebhook(
    @Req() req: RawRequest,
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    return this.integrations.githubWebhook(
      body as {
        repository?: { html_url?: string; full_name?: string };
        commits?: unknown[];
      },
      req.rawBody,
      signature,
    );
  }

  @Post('discord/notify')
  @UseGuards(RolesGuard)
  @Roles(...PENGURUS_ROLES)
  discordNotify(@Body() body: DiscordNotifyDto) {
    return this.integrations.discordNotify(body);
  }

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles(...PENGURUS_ROLES)
  status() {
    return this.integrations.status();
  }

  @Get('calendar/sync.ics')
  async calendarIcs(@Res() res: Response) {
    const ics = await this.integrations.calendarIcs();
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="itclub-kegiatan.ics"',
    );
    res.setHeader('Cache-Control', 'no-cache');
    res.send(ics);
  }
}
