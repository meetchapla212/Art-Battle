import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import ContestantModel from '../models/Contestant';
import { DataOperationResult } from '../../../shared/OperationResult';
import ContestantDTO  from '../../../shared/ContestantDTO';
import { ArtistService } from '../common/ArtistService';
import { sign } from 'jsonwebtoken';
import RegistrationModel from '../models/Registration';
import ArtistWooCommerceModel from '../models/ArtistWooCommerce';

export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistService = new ArtistService();
    // const list = await  artistService.List(req.user && req.user.Hash, req.app.get('cacheSet'), req.app.get('cacheGet'));
    const userId = req.user && req.user._id;
    const hash = req.user && req.user.Hash;
    let token: string = '';
    if (req.user) {
      token = sign({
        registrationId: req.user._id
      }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
      res.cookie('jwt', token, {
        httpOnly: true,
        sameSite: true,
        signed: true,
        secure: false
      });
    }
    res.redirect(307, `${process.env.SITE_URL}/resp/artists`);
    return;
    /*
    const list = await artistService.getArtistPageData(userId, hash, req.app.get('cacheSet'), req.app.get('cacheGet'));

    /*res.render('artist_list', {
      artistList: list,
      token: token
    });*/
    /*res.render('artist_list_v2', {
      artistList: list[0],
      followingArtist: list[1],
      token: token
    });*/
  } catch (e) {
    if (!e.status) {
      e.status = 500;
    }
    if (!e.message) {
      logger.error(e);
      e.message = 'Server error occurred!';
      e.Message = e.message;
    }
    next(e);
  }
};

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.body.searchTerm || '';
    /*const sortCol = req.body.sortCol || '_id';
    const sortOrder = req.body.sortOrder || -1;
    const sortObj: {
      [key: string]: number;
    } = {};
    sortObj[sortCol] = sortOrder;*/
    const artistService = new ArtistService();
    const resp = await artistService.searchArtists(searchTerm, req.body.limit,
        req.body.page, req.app.get('cacheSet'), req.app.get('cacheGet'));
    res.json(resp);
  } catch (e) {
    next(e);
  }
};

export const autoSuggest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.query.q || '';
    const or: any[] = [
      {
        $text: {
          $search: searchTerm,
        },
      },
      {
        Email: searchTerm
      }
    ];
    const entryId = parseInt(searchTerm);
    if (!isNaN(entryId)) {
      or.push({
        EntryId: entryId
      });
    }
    let query: {
      IsDuplicate?: {
        $in: any[];
      };
      EntryId?: {$exists: boolean};
      $or?: any[];
    } = {};
    if (searchTerm.length > 0) {
      query = {
        $or: or
      };
    }
    query.IsDuplicate = {$in: [null, false]};
    query.EntryId = {$exists: true};
    const results = await Promise.all([
    ContestantModel.find(query, { score: { $meta: 'textScore' } })
        .select(['_id', 'Name', 'EntryId'])
        .sort({ score: { $meta: 'textScore' } })
        // .limit(req.query.limit)
        // .skip((req.query.page - 1) * 10)
      ,
    ]);
    const contestants = results[0];
    const resp: DataOperationResult<{
      Contestants: ContestantDTO[];
    }> = {
      Success: true,
      Data: {
        Contestants: contestants,
      }
    };
    res.json(resp);
  } catch (e) {
    next(e);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contestantId = req.params.contestantId;
    if (!contestantId) {
      const message = `contestant Id is required`;
      logger.error(message);
      res.json({
        Success: false,
        status: 403,
        message: message
      });
      return ;
    }
    const contestant = await ContestantModel.findById(contestantId).populate('Registration');
    if (!contestant) {
      const message = `Invalid contestant Id passed ${contestantId}`;
      logger.error(message);
      res.json({
        Success: false,
        status: 404,
        message: message
      });
      return ;
    }
    const resp: DataOperationResult<ContestantDTO> = {
      Success: true,
      Data: contestant
    };
    res.json(resp);
  } catch (e) {
    if (!e.status) {
      e.status = 500;
    }
    if (!e.message) {
      e.message = 'Server error occurred!';
    }
    next(e);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistService = new ArtistService();
    const contestantId = req.params.contestantId;
    const contestant = await artistService.Update(contestantId, req.body, req.header('user-agent'));
    const resp: DataOperationResult<ContestantDTO> = {
      Success: true,
      Data: contestant
    };
    res.json(resp);
  } catch (e) {
    if (!e.status) {
      e.status = 500;
    }
    if (!e.message) {
      logger.error(e);
      e.message = 'Server error occurred!';
    }
    next(e);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistService = new ArtistService();
    const contestant = await artistService.Add(req.body, req.header('user-agent'));
    const resp: DataOperationResult<ContestantDTO> = {
      Success: true,
      Data: contestant
    };
    res.json(resp);
  } catch (e) {
    next(e);
  }
};

export const artistPublicProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistService = new ArtistService();
    const hash = req.params.hash;
    let regId;
    let phoneNumber;
    if (hash) {
      const result = await RegistrationModel.findOne({Hash: hash});
      if (result) {
        regId = result._id;
        phoneNumber = result.PhoneNumber;
      }
    }
    const userId = req.user && req.user._id || regId;
    phoneNumber = phoneNumber || req.user && req.user.PhoneNumber;
    const artistProfile = await artistService.cachedArtistProfile(req.app.get('cacheSet'), req.app.get('cacheGet'),
        req.params.contestantId, userId, phoneNumber);
    let token: string;
    if (req.user) {
      // set cookie only for those who opened in browser.
      // dup token calculation because we are targeting cookie based req.user here
      token = sign({
        registrationId: userId
      }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
    }
    let artistProfileJson = JSON.stringify(artistProfile);
    artistProfileJson = artistProfileJson.replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
    res.render('artist_public_profile', {
      token: token,
      artistId: req.params.contestantId,
      artistProfile: artistProfile,
      artistProfileJson: artistProfileJson,
      phoneHash: hash,
      title: artistProfile.Name
    });
  } catch (e) {
    next(e);
  }
};

export const follow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hash = req.params.hash;
    let regId;
    if (hash) {
      const result = await RegistrationModel.findOne({Hash: hash});
      if (result) {
        regId = result._id;
      }
    }
    const userId = req.user && req.user._id || regId;
    const artistService = new ArtistService();
    const contestantId = req.params.contestantId;
    await artistService.Follow(contestantId, userId, req.body.IsFollowing);
    const resp: DataOperationResult<string> = {
      Success: true,
      Data: 'Success'
    };
    res.json(resp);
  } catch (e) {
    if (!e.status) {
      e.status = 500;
    }
    if (!e.message) {
      logger.error(e);
      e.message = 'Server error occurred!';
    }
    next(e);
  }
};

export const redirectedToInternal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.entryId) {
      const contestant = await ContestantModel.findOne({EntryId: req.params.entryId}).select(['_id']);
      if (contestant) {
        res.redirect(`${process.env.SITE_URL}/ar/${contestant._id}/${req.params.hash || ''}`);
        return ;
      }
    }
    next({
      Success: false,
      status: 404,
      Message: 'Entry Id not found'
    });
    return ;
  } catch (e) {
    next(e);
  }
};

export const addVideo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistId = req.params.artistId;
    const videoUrl = req.body.URL;
    await ContestantModel.update(
        {_id: artistId},
    { $push: { Videos: videoUrl } }
    );
    const resp: DataOperationResult<string> = {
      Success: true,
      Data: 'Success'
    };
    res.json(resp);
  } catch (e) {
    next(e);
  }
};

export const wooList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.body.searchTerm || '';
    /*const sortCol = req.body.sortCol || '_id';
    const sortOrder = req.body.sortOrder || -1;
    const sortObj: {
      [key: string]: number;
    } = {};
    sortObj[sortCol] = sortOrder;*/
    const artistService = new ArtistService();
    const resp = await artistService.getProducts(searchTerm, req.body.limit, req.body.page);
    res.json(resp);
  } catch (e) {
    next(e);
  }
};

export const saveProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: {
      ProductId: string;
      Confirmation: string;
      ContestantId: any;
    } = req.body;
    const product = await ArtistWooCommerceModel.findOne({ProductId: payload.ProductId});
    const artistService = new ArtistService();
    if (product) {
      res.json(await artistService.updateProduct(payload, product, req.app.get('cacheSet'), req.app.get('cacheGet')));
    } else {
      res.json(await artistService.addProduct(payload, req.app.get('cacheSet'), req.app.get('cacheGet')));
    }
  } catch (e) {
    next(e);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistService = new ArtistService();
    await artistService.removeProduct(req.params.productId, req.app.get('cacheSet'), req.app.get('cacheGet'));
    const resp: DataOperationResult<string> = {
      Success: true,
      Data: 'Success'
    };
    res.json(resp);
  } catch (e) {
    next(e);
  }
};

export const refreshProductCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistService = new ArtistService();
    await artistService.updateProductCache(req.params.productId, req.app.get('cacheSet'), req.app.get('cacheGet'));
    const resp: DataOperationResult<string> = {
      Success: true,
      Data: 'Success'
    };
    res.json(resp);
  } catch (e) {
    next(e);
  }
};