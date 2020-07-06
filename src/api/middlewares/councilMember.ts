import { Container } from 'typedi';
import mongoose from 'mongoose';
import { HttpError } from '../../services/utils';
import { ICouncil } from '../../interfaces/ICouncil';

const councilMember = async (req, res, next) => {
  const Logger = Container.get('logger');
  try {
    const id = req.params.id;
    const Council = Container.get('Council') as mongoose.Model<ICouncil & mongoose.Document>;

    const data = await Council.aggregate([
      {
        $match: {
          accountId: id,
        },
      },
      {
        $lookup: {
          from: 'accountidentities',
          localField: 'accountId',
          foreignField: 'accountId',
          as: 'memberIdentity',
        },
      },
      {
        $lookup: {
          from: 'accountidentities',
          localField: 'backersInfo.backer',
          foreignField: 'stashId',
          as: 'backersIdentity',
        },
      },
      {
        $lookup: {
          from: 'councilidentities',
          localField: 'accountId',
          foreignField: 'accountId',
          as: 'additionalInfo',
        },
      },
    ]);

    if (data.length == 0) {
      Logger.error('🔥 No Data found: %o');
      throw new HttpError(404, 'No data found');
    }

    const result = data.map((x) => {
      const totalBalance = x.totalBalance / Math.pow(10, 12);
      const backing = x.stake / Math.pow(10, 12);
      const name = x.memberIdentity[0] !== undefined ? x.memberIdentity[0].display : null;
      const backersInfo = x.backersInfo.map((y) => {
        const stake = y.stake / Math.pow(10, 12);
        const backerName = x.backersIdentity.filter((z) => z.accountId == y.backer);
        return {
          stake: stake,
          backer: y.backer,
          name: backerName[0] !== undefined ? backerName[0].display : null,
        };
      });

      const additionalInfo =
        data[0].additionalInfo[0] !== undefined
          ? data[0].additionalInfo.map((x) => {
              return {
                vision: x.vision,
                members: x.members.map((y) => {
                  return {
                    member: y.member,
                    role: y.role !== undefined ? y.role : null,
                    twitter: y.twitter !== undefined ? y.twitter : null,
                  };
                }),
              };
            })
          : [{}];
      return {
        name: name,
        accountId: x.accountId,
        backing: backing,
        totalBalance: totalBalance,
        backersInfo: backersInfo,
        additionalInfo: additionalInfo[0],
      };
    });

    return res.json(result[0]).status(200);
  } catch (e) {
    Logger.error('🔥 Error fetching council data: %o', e);
    return next(e);
  }
};

export default councilMember;