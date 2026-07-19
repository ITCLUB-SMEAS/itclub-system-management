import { Controller, Get, Param } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('portfolio')
export class PortfolioController {
  constructor(private portfolio: PortfolioService) {}

  @Public()
  @Get('showcase')
  showcase() {
    return this.portfolio.showcase();
  }

  @Public()
  @Get(':memberId')
  memberPortfolio(@Param('memberId') memberId: string) {
    return this.portfolio.memberPortfolio(memberId);
  }
}
